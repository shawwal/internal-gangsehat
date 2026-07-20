import { ClipboardCheck } from 'lucide-react'
import { MedicalRecordCard } from './MedicalRecordCard'
import type { MedicalRecordRow } from '@/app/actions/medicalRecords'

interface Props {
  loading: boolean
  rows: MedicalRecordRow[]
  isTeamView: boolean
  hasAnyRecords: boolean
  onOpenQuickForm: (visitId: string) => void
  onRemind?: (visitId: string) => void
  remindingIds: Set<string>
  remindedIds: Set<string>
}

export function MedicalRecordsList({
  loading, rows, isTeamView, hasAnyRecords,
  onOpenQuickForm, onRemind, remindingIds, remindedIds,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-muted rounded-3xl h-28" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck size={22} className="text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {hasAnyRecords ? 'Tidak ada hasil yang cocok' : 'Belum ada rekam medis yang perlu ditinjau'}
        </p>
        <p className="text-xs text-muted-foreground text-center">
          {hasAnyRecords
            ? 'Coba ubah kata kunci pencarian atau filter.'
            : 'Kunjungan yang selesai akan muncul di sini untuk dicek kelengkapannya.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((record) => (
        <MedicalRecordCard
          key={record.id}
          record={record}
          isTeamView={isTeamView}
          onOpenQuickForm={onOpenQuickForm}
          onRemind={onRemind}
          reminding={remindingIds.has(record.id)}
          reminded={remindedIds.has(record.id)}
        />
      ))}
    </div>
  )
}
