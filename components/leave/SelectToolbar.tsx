import { Trash2 } from 'lucide-react'

interface Props {
  allSelected: boolean
  someSelected: boolean
  selectedCount: number
  onToggleAll: () => void
  onBulkDelete: () => void
}

export function SelectToolbar({ allSelected, someSelected, selectedCount, onToggleAll, onBulkDelete }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 border border-primary/20">
      <button
        onClick={onToggleAll}
        className="flex items-center gap-2 text-sm text-foreground hover:opacity-80 transition-opacity"
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
          allSelected ? 'bg-primary border-primary' : someSelected ? 'border-primary' : 'border-border bg-background'
        }`}>
          {allSelected && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {!allSelected && someSelected && (
            <div className="w-2 h-0.5 bg-primary rounded" />
          )}
        </div>
        <span className="text-xs font-medium">
          {allSelected ? 'Batalkan semua' : 'Pilih semua'}
        </span>
      </button>

      {someSelected && (
        <>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-xs font-medium text-primary">{selectedCount} dipilih</span>
          <button
            onClick={onBulkDelete}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive text-white text-xs font-medium hover:bg-destructive/90 transition-colors"
          >
            <Trash2 size={12} /> Hapus {selectedCount} Data
          </button>
        </>
      )}
    </div>
  )
}
