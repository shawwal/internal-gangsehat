'use client'

import { useState } from 'react'
import { FileImage, Loader2, X } from 'lucide-react'
import { PaymentProofField } from './PaymentProofField'
import { PAYMENT_PROOF_REQUIRED_MSG } from '@/lib/paymentProof'

interface Props {
  /** Transfer method the proof is for (shown in the header). */
  method: string
  initialPath?: string | null
  subtitle?: string
  onCancel: () => void
  /** Persist the uploaded path; return an error message to keep the dialog open. */
  onSubmit: (path: string) => Promise<string | null>
}

/** Standalone "Unggah Bukti Transfer" modal — for places without a full payment
 *  form, e.g. switching a method to transfer inline, or attaching a proof to an
 *  existing payment. */
export function PaymentProofDialog({ method, initialPath = null, subtitle, onCancel, onSubmit }: Props) {
  const [path, setPath] = useState<string | null>(initialPath)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!path) { setError(PAYMENT_PROOF_REQUIRED_MSG); return }
    setSaving(true)
    setError(null)
    const err = await onSubmit(path)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={saving ? undefined : onCancel}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileImage size={15} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Bukti Transfer</p>
              <p className="text-xs text-muted-foreground truncate">{subtitle ? `${subtitle} · ` : ''}{method}</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={saving} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <PaymentProofField method={method} value={path} onChange={setPath} onUploadingChange={setUploading} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading || !path}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
