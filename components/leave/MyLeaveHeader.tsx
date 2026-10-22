import { PlusCircle } from 'lucide-react'

interface Props {
  showForm: boolean
  onToggle: () => void
}

export function MyLeaveHeader({ showForm, onToggle }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">Perizinan</h1>
        <p className="text-sm text-muted-foreground">Ajukan dan pantau status perizinan Anda</p>
      </div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
      >
        <PlusCircle size={15} />
        {showForm ? 'Tutup Form' : 'Ajukan Izin'}
      </button>
    </div>
  )
}
