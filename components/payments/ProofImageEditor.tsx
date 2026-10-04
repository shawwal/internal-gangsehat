'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Crop, Loader2, Maximize, RotateCw, Wand2, X } from 'lucide-react'
import { loadImage, renderWebp, type NormalizedCrop } from '@/lib/imageCompress'
import { detectContentBounds } from '@/lib/autoCrop'

// Working copy cap: big enough to crop a 48 MP photo without losing detail at
// the 1600px output, small enough to stay under iOS Safari's canvas limits.
const WORK_MAX_DIMENSION = 3000
const DETECT_MAX_DIMENSION = 256
const MIN_CROP = 0.05
const FULL: NormalizedCrop = { x: 0, y: 0, w: 1, h: 1 }

type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Props {
  file: File
  maxDimension: number
  quality: number
  maxBytes: number
  onCancel: () => void
  /** Receives the cropped, compressed WebP. */
  onDone: (file: File) => void
}

function scaledCanvas(source: CanvasImageSource, w: number, h: number, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = src.height
  canvas.height = src.width
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(src, 0, 0)
  return canvas
}

function detect(work: HTMLCanvasElement): NormalizedCrop | null {
  const small = scaledCanvas(work, work.width, work.height, DETECT_MAX_DIMENSION)
  const ctx = small.getContext('2d')!
  return detectContentBounds(ctx.getImageData(0, 0, small.width, small.height))
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const sameCrop = (a: NormalizedCrop | null, b: NormalizedCrop) =>
  !!a && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.w - b.w) < 1e-6 && Math.abs(a.h - b.h) < 1e-6

function formatMb(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

/** Crop / rotate step between picking a photo and uploading it. Accepts any
 *  size — the result is re-encoded to a small WebP. */
export function ProofImageEditor({ file, maxDimension, quality, maxBytes, onCancel, onDone }: Props) {
  const workRef = useRef<HTMLCanvasElement | null>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: DragMode; x: number; y: number; start: NormalizedCrop; rect: DOMRect } | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [crop, setCrop] = useState<NormalizedCrop>(FULL)
  const [auto, setAuto] = useState<NormalizedCrop | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Decode once into the working canvas.
  useEffect(() => {
    let cancelled = false
    loadImage(file)
      .then((img) => {
        if (cancelled) return
        const work = scaledCanvas(img, img.naturalWidth, img.naturalHeight, WORK_MAX_DIMENSION)
        workRef.current = work
        setAuto(detect(work))
        setVersion((v) => v + 1)
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [file])

  // Paint the on-screen preview whenever the working canvas changes.
  useEffect(() => {
    const work = workRef.current
    const display = displayRef.current
    if (!work || !display) return
    const preview = scaledCanvas(work, work.width, work.height, 1400)
    display.width = preview.width
    display.height = preview.height
    display.getContext('2d')!.drawImage(preview, 0, 0)
  }, [version])

  function rotate() {
    if (!workRef.current) return
    const work = rotate90(workRef.current)
    workRef.current = work
    setAuto(detect(work))
    setCrop(FULL)
    setVersion((v) => v + 1)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const mode = (e.target as HTMLElement).dataset.drag as DragMode | undefined
    const frame = frameRef.current
    if (!mode || !frame || status !== 'ready') return
    e.preventDefault()
    frame.setPointerCapture(e.pointerId)
    dragRef.current = { mode, x: e.clientX, y: e.clientY, start: crop, rect: frame.getBoundingClientRect() }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.x) / d.rect.width
    const dy = (e.clientY - d.y) / d.rect.height
    const s = d.start
    if (d.mode === 'move') {
      setCrop({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) })
      return
    }
    let l = s.x, t = s.y, r = s.x + s.w, b = s.y + s.h
    if (d.mode.includes('w')) l = clamp(l + dx, 0, r - MIN_CROP)
    if (d.mode.includes('e')) r = clamp(r + dx, l + MIN_CROP, 1)
    if (d.mode.includes('n')) t = clamp(t + dy, 0, b - MIN_CROP)
    if (d.mode.includes('s')) b = clamp(b + dy, t + MIN_CROP, 1)
    setCrop({ x: l, y: t, w: r - l, h: b - t })
  }

  function endDrag() {
    dragRef.current = null
  }

  async function confirm() {
    const work = workRef.current
    if (!work) return
    setStatus('saving')
    setSaveError(null)
    try {
      const blob = await renderWebp(work, work.width, work.height, { maxDimension, quality, maxBytes, crop })
      onDone(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }))
    } catch {
      setSaveError('Gagal memproses gambar. Coba lagi atau gunakan foto lain.')
      setStatus('ready')
    }
  }

  const busy = status === 'saving'
  const cropStyle = {
    left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
    width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
  }
  const handle = 'absolute w-5 h-5 -m-2.5 rounded-full bg-white border-2 border-primary shadow touch-none'
  const edge = 'absolute bg-white border-2 border-primary rounded-full shadow touch-none'

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] p-3 sm:p-4" onClick={busy ? undefined : onCancel}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-3xl max-h-full flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Crop size={15} className="text-primary" /> Atur Bukti Transfer</p>
            <p className="text-[11px] text-muted-foreground truncate">Ukuran asli {formatMb(file.size)} · akan dikompres ke WebP</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-black/90 flex items-center justify-center p-4 overflow-hidden">
          {status === 'loading' && <Loader2 size={24} className="animate-spin text-white/70" />}
          {status === 'error' && (
            <p className="text-sm text-white/90 text-center max-w-xs">
              Gambar tidak dapat dibuka. Gunakan foto JPG/PNG atau screenshot, atau ambil foto ulang.
            </p>
          )}
          <div
            ref={frameRef}
            className={`relative max-w-full select-none touch-none ${status === 'loading' || status === 'error' ? 'hidden' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <canvas ref={displayRef} className="block max-w-full max-h-[60vh] w-auto h-auto" />
            {/* Dimmed area outside the crop, clipped to the image; handles live
                in a separate unclipped layer so they stay grabbable at the edges. */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute" style={{ ...cropStyle, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }} />
            </div>
            <div
              className="absolute border-2 border-white cursor-move touch-none"
              style={cropStyle}
              data-drag="move"
            >
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/25" />)}
              </div>
              <div className={`${handle} left-0 top-0 cursor-nwse-resize`} data-drag="nw" />
              <div className={`${handle} right-0 top-0 cursor-nesw-resize`} data-drag="ne" />
              <div className={`${handle} left-0 bottom-0 cursor-nesw-resize`} data-drag="sw" />
              <div className={`${handle} right-0 bottom-0 cursor-nwse-resize`} data-drag="se" />
              <div className={`${edge} w-8 h-2.5 left-1/2 -ml-4 -top-1.5 cursor-ns-resize`} data-drag="n" />
              <div className={`${edge} w-8 h-2.5 left-1/2 -ml-4 -bottom-1.5 cursor-ns-resize`} data-drag="s" />
              <div className={`${edge} h-8 w-2.5 top-1/2 -mt-4 -left-1.5 cursor-ew-resize`} data-drag="w" />
              <div className={`${edge} h-8 w-2.5 top-1/2 -mt-4 -right-1.5 cursor-ew-resize`} data-drag="e" />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => auto && setCrop(auto)}
              disabled={!auto || busy || status !== 'ready'}
              title={auto ? 'Potong otomatis ke area bukti' : 'Tidak ada area yang bisa dipotong otomatis'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sameCrop(auto, crop) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-foreground'}`}
            >
              <Wand2 size={13} /> Crop otomatis
            </button>
            <button
              type="button"
              onClick={() => setCrop(FULL)}
              disabled={busy || status !== 'ready'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${sameCrop(crop, FULL) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted text-foreground'}`}
            >
              <Maximize size={13} /> Tanpa crop
            </button>
            <button
              type="button"
              onClick={rotate}
              disabled={busy || status !== 'ready'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={13} /> Putar
            </button>
            <p className="text-[11px] text-muted-foreground w-full sm:w-auto sm:ml-auto">Geser sudut kotak untuk crop manual</p>
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy || status !== 'ready'}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {busy ? <><Loader2 size={14} className="animate-spin" /> Mengompres...</> : 'Gunakan Foto'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
