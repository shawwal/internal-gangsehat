import { PlusCircle } from 'lucide-react'

interface Props {
  showForm: boolean
  onToggle: () => void
}

export function MyLeaveHeader({ showForm, onToggle }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pengajuan Cuti</h1>
        <p className="text-sm text-muted-foreground">Ajukan dan pantau status cuti Anda</p>
      </div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
      >
        <PlusCircle size={15} />
        {showForm ? 'Tutup Form' : 'Ajukan Cuti'}
      </button>
    </div>
  )
}
