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
      {/* Spacer so the sticky bar never covers the last card on mobile */}
      <div className="h-20 sm:h-0" />

      <div className="fixed bottom-0 inset-x-0 sm:static z-30 sm:z-auto bg-background/95 sm:bg-transparent backdrop-blur-lg sm:backdrop-blur-none border-t border-border sm:border-0 p-4 sm:p-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-0">
        {submitError && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl mb-3">{submitError}</p>
        )}
        <div className="flex gap-3 max-w-3xl mx-auto sm:mx-0 sm:max-w-none sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} /> Kembali
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </>
  )
}
