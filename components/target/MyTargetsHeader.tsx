import { PlusCircle } from 'lucide-react'

interface Props {
  showForm: boolean
  onCreateClick: () => void
}

export function MyTargetsHeader({ showForm, onCreateClick }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Target Saya</h1>
        <p className="text-sm text-muted-foreground">Ajukan dan pantau target bulanan Anda</p>
      </div>
      {!showForm && (
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
        >
          <PlusCircle size={15} /> Buat Target
        </button>
      )}
    </div>
  )
}
