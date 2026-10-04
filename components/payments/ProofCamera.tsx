'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Loader2, SwitchCamera, Upload, X } from 'lucide-react'

interface Props {
  onCancel: () => void
  onCapture: (file: File) => void
  /** Camera unavailable or denied — let the user pick a file instead. */
  onPickFile: () => void
}

/** In-app camera (getUserMedia) for devices whose file input can't open the
 *  camera directly — laptops/desktops with a webcam. Phones and tablets use the
 *  native camera via `<input capture>` instead (better focus & resolution). */
export function ProofCamera({ onCancel, onCapture, onPickFile }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canFlip, setCanFlip] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    const media = navigator.mediaDevices
    const request = media?.getUserMedia
      ? media.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      : Promise.reject(new DOMException('getUserMedia unavailable', 'NotSupportedError'))
    request
      .then(async (s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        await video.play().catch(() => {})
        setReady(true)
        const devices = await media.enumerateDevices()
        if (!cancelled) setCanFlip(devices.filter((d) => d.kind === 'videoinput').length > 1)
      })
      .catch((err: DOMException) => {
        if (cancelled) return
        setError(
          err?.name === 'NotAllowedError' ? 'Akses kamera ditolak. Izinkan kamera di pengaturan browser, atau pilih file.'
            : err?.name === 'NotSupportedError' ? 'Browser ini tidak mendukung kamera.'
              : 'Kamera tidak ditemukan atau sedang dipakai aplikasi lain.',
        )
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  function flip() {
    setReady(false)
    setError(null)
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
  }

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300] p-4" onClick={onCancel}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Camera size={15} className="text-primary" /> Foto Bukti Transfer</p>
          <button type="button" onClick={onCancel} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="relative bg-black aspect-video flex items-center justify-center">
          <video ref={videoRef} playsInline muted className={`w-full h-full object-contain ${ready ? '' : 'invisible'}`} />
          {!ready && !error && <Loader2 size={24} className="absolute animate-spin text-white/70" />}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-white/90">{error}</p>
              <button type="button" onClick={onPickFile} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors cursor-pointer">
                <Upload size={14} /> Pilih file
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
          <button type="button" onClick={onPickFile} className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            Pilih file saja
          </button>
          <div className="flex items-center gap-2">
            {canFlip && (
              <button
                type="button"
                onClick={flip}
                aria-label="Ganti kamera"
                className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <SwitchCamera size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={capture}
              disabled={!ready}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Camera size={14} /> Ambil Foto
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
