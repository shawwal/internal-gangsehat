'use client'

import { EditableCell } from './EditableCell'
import { formatCurrency } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { KehadiranBadge } from './KehadiranBadge'
import { RowActions } from './RowActions'
import { formatShortDate, type JadwalListRow as Row } from './types'

interface Props {
  row: Row
  no: number
  onRemind: (row: Row) => void
  onConfirm: (row: Row) => void
  onCancel: (row: Row) => void | Promise<void>
  fisioOptions: { value: string; label: string }[]
  onEdit: (row: Row, field: EditField, value: string) => Promise<void>
}

export type EditField = 'visit_date' | 'visit_time' | 'attending_staff_id' | 'chief_complaint' | 'kehadiran' | 'notes'

const KEHADIRAN_OPTIONS = [
  { value: '', label: '—' },
  { value: 'HADIR', label: 'Hadir' },
  { value: 'TIDAK HADIR', label: 'Tidak Hadir' },
]

const td = 'px-4 py-3 align-top text-sm text-foreground'

export function JadwalListRow({ row, no, onRemind, onConfirm, onCancel, fisioOptions, onEdit }: Props) {
  return (
    <tr className="border-b border-border/50 hover:bg-primary/5 transition-colors">
      <td className={td}>{no}</td>
      <td className={`${td} whitespace-nowrap`}>
        <EditableCell type="date" value={row.visit_date} display={formatShortDate(row.visit_date)}
          onSave={(v) => onEdit(row, 'visit_date', v)} />
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <EditableCell type="time" value={row.visit_time ?? ''} onSave={(v) => onEdit(row, 'visit_time', v)} />
      </td>
      <td className={td}>
        <button
          onClick={() => window.open(`/patients/${row.patient_id}`, '_blank', 'noopener,noreferrer')}
          className="text-primary font-medium hover:underline cursor-pointer text-left"
        >
          {row.patient_name}
        </button>
      </td>
      <td className={td}>{row.patient_age ?? '—'}</td>
      <td className={td}>
        <EditableCell value={row.chief_complaint ?? ''} placeholder="Keluhan"
          onSave={(v) => onEdit(row, 'chief_complaint', v)} />
      </td>
      <td className={td}>
        <EditableCell type="select" value={row.attending_staff_id ?? ''} display={row.attending_staff_name ?? '—'}
          options={[{ value: '', label: '—' }, ...fisioOptions]}
          onSave={(v) => onEdit(row, 'attending_staff_id', v)} />
      </td>
      <td className={td}>{row.layanan_label ?? '—'}</td>
      <td className={td}>{row.pertemuan_ke}</td>
      <td className={`${td} whitespace-nowrap`}>{formatCurrency(row.kurang_bayar)}</td>
      <td className={td}>
        <EditableCell type="select" value={row.kehadiran ?? ''} display={<KehadiranBadge kehadiran={row.kehadiran} />}
          options={KEHADIRAN_OPTIONS} onSave={(v) => onEdit(row, 'kehadiran', v)} />
      </td>
      <td className={td}><StatusBadge status={row.admin_status} /></td>
      <td className={td}>
        <EditableCell value={row.notes ?? ''} placeholder="Catatan admin"
          onSave={(v) => onEdit(row, 'notes', v)} />
      </td>
      <td className={td}>
        <RowActions row={row} onRemind={onRemind} onConfirm={onConfirm} onCancel={onCancel} />
      </td>
    </tr>
  )
}
