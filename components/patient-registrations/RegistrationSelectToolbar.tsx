'use client'

import { Check, CheckCircle2, Trash2 } from 'lucide-react'

interface Props {
  allSelected: boolean
  selectedCount: number
  /** Selected rows that are still pending — only these can be approved. */
  pendingSelectedCount: number
  onToggleAll: () => void
  onBulkApprove: () => void
  onBulkDelete: () => void
}

export function RegistrationSelectToolbar({
  allSelected, selectedCount, pendingSelectedCount, onToggleAll, onBulkApprove, onBulkDelete,
}: Props) {
  const someSelected = selectedCount > 0
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 border border-primary/20">
      <button
        onClick={onToggleAll}
        className="flex items-center gap-2 text-sm text-foreground hover:opacity-80 transition-opacity"
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
          allSelected ? 'bg-primary border-primary' : someSelected ? 'border-primary' : 'border-border bg-background'
        }`}>
          {allSelected && <Check size={11} className="text-white" strokeWidth={3} />}
          {!allSelected && someSelected && <div className="w-2 h-0.5 bg-primary rounded" />}
        </div>
        <span className="text-xs font-medium">{allSelected ? 'Batalkan semua' : 'Pilih semua'}</span>
      </button>

      {someSelected && (
        <>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-xs font-medium text-primary">{selectedCount} dipilih</span>
          <div className="ml-auto flex items-center gap-2">
            {pendingSelectedCount > 0 && (
              <button
                onClick={onBulkApprove}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-chart-4 text-white text-xs font-medium hover:bg-chart-4/90 transition-colors"
              >
                <CheckCircle2 size={12} /> Setujui {pendingSelectedCount}
              </button>
            )}
            <button
              onClick={onBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive text-white text-xs font-medium hover:bg-destructive/90 transition-colors"
            >
              <Trash2 size={12} /> Hapus {selectedCount}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
