'use client'

import { ArrowLeft, Check, Loader2 } from 'lucide-react'

interface Props {
  saving: boolean
  submitError: string | null
  onCancel: () => void
  onSubmit: () => void
}

export function OrderFormActions({ saving, submitError, onCancel, onSubmit }: Props) {
  return (
    <>
      {/* Spacer so the floating bar never covers the last card on mobile */}
      <div className="h-20 md:h-0" />

      {/* Below md the bottom tab bar (z-40, ~5.5rem tall incl. margin) is visible,
          so the bar floats just above it instead of at the screen edge. */}
      <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:static z-30 md:z-auto bg-background/95 md:bg-transparent backdrop-blur-lg md:backdrop-blur-none border border-border md:border-0 rounded-2xl md:rounded-none p-3 md:p-0 shadow-lg md:shadow-none">
        {submitError && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl mb-3">{submitError}</p>
        )}
        <div className="flex gap-3 max-w-3xl mx-auto md:mx-0 md:max-w-none md:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} /> Kembali
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </>
  )
}
