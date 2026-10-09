'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, FileImage, Loader2, RefreshCw, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadErrorMessage } from '@/lib/storageErrors'
import { PAYMENT_PROOF_BUCKET, isGatewayReceiptPath, proofBucketFor, requiresPaymentProof } from '@/lib/paymentProof'
import { ProofImageEditor } from './ProofImageEditor'
import { ProofCamera } from './ProofCamera'

// Originals can be any size (camera photos are often 5–15 MB); the editor
// crops and re-encodes them, and only the compressed WebP must fit the bucket.
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB — matches bucket file_size_limit (migration 092)
// Transfer receipts are mostly phone screenshots: 1600px on the long side keeps
// account numbers and amounts legible while landing around 100–250 KB.
const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.75
const SIGNED_URL_TTL = 60 * 60

/** Resolve a private `payment-proofs` path to a short-lived signed URL. */
export function usePaymentProofUrl(path: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<{ path: string; url: string } | null>(null)
  useEffect(() => {
    if (!path) return
    let cancelled = false
    createClient().storage.from(proofBucketFor(path)).createSignedUrl(path, SIGNED_URL_TTL).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setResolved({ path, url: data.signedUrl })
    })
    return () => { cancelled = true }
  }, [path])
  return path && resolved?.path === path ? resolved.url : null
}

function newProofPath(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yyyy}/${mm}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`
}

interface FieldProps {
  /** Payment method currently selected; the field only renders for transfers. */
  method: string | null | undefined
  /** Object path inside the `payment-proofs` bucket, or null. */
  value: string | null
  onChange: (path: string | null) => void
  /** Reports upload-in-progress so the parent can block submit. */
  onUploadingChange?: (uploading: boolean) => void
  /** Show the "wajib" marker. Defaults to true. */
  required?: boolean
  compact?: boolean
}

/** Phones and tablets open the native camera from `<input capture>`; laptops
 *  ignore `capture`, so they get the in-app webcam dialog instead. */
function prefersNativeCamera(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(any-pointer: coarse)').matches
}

/** Bukti transfer upload — take a photo or pick a file of any size, crop it
 *  (manual or auto), then it's compressed to WebP and uploaded to the private
 *  bucket. Renders nothing unless `method` requires a proof. */
export function PaymentProofField({ method, value, onChange, onUploadingChange, required = true, compact }: FieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const previewUrl = usePaymentProofUrl(value)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [webcamOpen, setWebcamOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  if (!requiresPaymentProof(method)) return null

  function setBusy(v: boolean) {
    setUploading(v)
    onUploadingChange?.(v)
  }

  function pickFile() {
    setWebcamOpen(false)
    inputRef.current?.click()
  }

  function openCamera() {
    if (prefersNativeCamera()) cameraInputRef.current?.click()
    else setWebcamOpen(true)
  }

  function acceptFile(file: File | undefined) {
    if (!file) return
    if (file.type && !file.type.startsWith('image/')) { setError('File harus berupa gambar (foto atau screenshot).'); return }
    setError(null)
    setPendingFile(file)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    acceptFile(file)
  }

  async function upload(file: File) {
    setPendingFile(null)
    setError(null)
    if (file.size > MAX_SIZE_BYTES) { setError('Gambar terlalu detail untuk dikompres. Crop lebih kecil lalu coba lagi.'); return }
    setBusy(true)
    try {
      const path = newProofPath()
      const { error: upErr } = await createClient().storage
        .from(PAYMENT_PROOF_BUCKET)
        .upload(path, file, { upsert: false, contentType: 'image/webp' })
      if (upErr) { setError(uploadErrorMessage(upErr.message)); return }
      onChange(path)
    } finally {
      setBusy(false)
    }
  }

  const sourceButton = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer disabled:opacity-50'

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-foreground">
        Bukti Transfer{' '}
        {required
          ? <span className="text-destructive">*</span>
          : <span className="text-muted-foreground font-normal">(opsional)</span>}
      </label>
      <input ref={inputRef} id={inputId} type="file" accept="image/*" onChange={handleInput} className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleInput} className="hidden" />

      {value ? (
        <div className="flex items-center gap-3 p-2 rounded-xl border border-border bg-muted/30">
          <a
            href={previewUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center"
          >
            {previewUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={previewUrl} alt="Bukti transfer" className="w-full h-full object-cover" />
              : <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </a>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Bukti terunggah</p>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">
                Lihat ukuran penuh
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={openCamera}
            aria-label="Foto ulang"
            title="Foto ulang"
            disabled={uploading}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Camera size={14} />
          </button>
          <button
            type="button"
            onClick={pickFile}
            aria-label="Ganti bukti"
            title="Ganti dengan file lain"
            disabled={uploading}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Hapus bukti"
            disabled={uploading}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]) }}
          className={`${compact ? 'p-2.5' : 'p-3'} border-2 border-dashed rounded-xl transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-foreground">
              <Loader2 size={15} className="animate-spin text-primary" /> Mengunggah...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={openCamera} className={`${sourceButton} ${compact ? 'py-2' : 'py-2.5'}`}>
                  <Camera size={14} /> Ambil Foto
                </button>
                <button type="button" onClick={pickFile} className={`${sourceButton} ${compact ? 'py-2' : 'py-2.5'}`}>
                  <Upload size={14} /> Pilih File
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                Foto / screenshot ukuran berapa pun · bisa di-crop · otomatis dikompres ke WebP
              </p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {webcamOpen && (
        <ProofCamera
          onCancel={() => setWebcamOpen(false)}
          onPickFile={pickFile}
          onCapture={(file) => { setWebcamOpen(false); acceptFile(file) }}
        />
      )}
      {pendingFile && (
        <ProofImageEditor
          file={pendingFile}
          maxDimension={MAX_DIMENSION}
          quality={WEBP_QUALITY}
          maxBytes={MAX_SIZE_BYTES}
          onCancel={() => setPendingFile(null)}
          onDone={upload}
        />
      )}
    </div>
  )
}

/** Small "Bukti" button for tables/lists; renders nothing without a path.
 *  Signs the URL on click so long tables don't fire one request per row. */
export function PaymentProofLink({ path, label }: { path: string | null | undefined; label?: string }) {
  const [opening, setOpening] = useState(false)
  if (!path) return null
  const isReceipt = isGatewayReceiptPath(path)

  async function open(e: React.MouseEvent) {
    e.stopPropagation()
    if (!path || opening) return
    // Open the tab synchronously (inside the click) so popup blockers allow it.
    const win = window.open('', '_blank')
    setOpening(true)
    const { data } = await createClient().storage.from(proofBucketFor(path)).createSignedUrl(path, SIGNED_URL_TTL)
    setOpening(false)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else win?.close()
  }

  return (
    <button
      type="button"
      onClick={open}
      title={isReceipt ? 'Lihat kwitansi DOKU' : 'Lihat bukti transfer'}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
    >
      {opening ? <Loader2 size={10} className="animate-spin" /> : <FileImage size={10} />} {label ?? (isReceipt ? 'Kwitansi' : 'Bukti')}
    </button>
  )
}
