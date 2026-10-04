'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { FileImage, Loader2, RefreshCw, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadErrorMessage } from '@/lib/storageErrors'
import { compressImageToWebp } from '@/lib/imageCompress'
import { PAYMENT_PROOF_BUCKET, requiresPaymentProof } from '@/lib/paymentProof'

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
    createClient().storage.from(PAYMENT_PROOF_BUCKET).createSignedUrl(path, SIGNED_URL_TTL).then(({ data }) => {
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

/** Bukti transfer upload — compresses to WebP client-side, then uploads to the
 *  private bucket. Renders nothing unless `method` requires a proof. */
export function PaymentProofField({ method, value, onChange, onUploadingChange, required = true, compact }: FieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrl = usePaymentProofUrl(value)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!requiresPaymentProof(method)) return null

  function setBusy(v: boolean) {
    setUploading(v)
    onUploadingChange?.(v)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!original) return
    setError(null)
    setBusy(true)
    try {
      // Always re-encoded to WebP; anything the browser can't decode (e.g. HEIC
      // outside Safari) is rejected rather than stored raw.
      const file = await compressImageToWebp(original, { maxDimension: MAX_DIMENSION, quality: WEBP_QUALITY })
      if (file.type !== 'image/webp') { setError('Format tidak didukung. Gunakan JPG, PNG, atau screenshot.'); return }
      if (file.size > MAX_SIZE_BYTES) { setError('Ukuran file maksimal 2 MB setelah kompresi.'); return }
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

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-foreground">
        Bukti Transfer{' '}
        {required
          ? <span className="text-destructive">*</span>
          : <span className="text-muted-foreground font-normal">(opsional)</span>}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

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
          <label
            htmlFor={inputId}
            aria-label="Ganti bukti"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer transition-colors"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </label>
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
        <label
          htmlFor={inputId}
          className={`flex items-center gap-3 ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group`}
        >
          <div className="w-9 h-9 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
            {uploading
              ? <Loader2 size={15} className="animate-spin text-primary" />
              : <Upload size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{uploading ? 'Mengompres & mengunggah...' : 'Unggah bukti transfer'}</p>
            <p className="text-[11px] text-muted-foreground">JPG, PNG, screenshot · otomatis dikompres ke WebP</p>
          </div>
        </label>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** Small "Bukti" button for tables/lists; renders nothing without a path.
 *  Signs the URL on click so long tables don't fire one request per row. */
export function PaymentProofLink({ path, label = 'Bukti' }: { path: string | null | undefined; label?: string }) {
  const [opening, setOpening] = useState(false)
  if (!path) return null

  async function open(e: React.MouseEvent) {
    e.stopPropagation()
    if (!path || opening) return
    // Open the tab synchronously (inside the click) so popup blockers allow it.
    const win = window.open('', '_blank')
    setOpening(true)
    const { data } = await createClient().storage.from(PAYMENT_PROOF_BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
    setOpening(false)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else win?.close()
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Lihat bukti transfer"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
    >
      {opening ? <Loader2 size={10} className="animate-spin" /> : <FileImage size={10} />} {label}
    </button>
  )
}
