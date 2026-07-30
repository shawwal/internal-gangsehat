'use client'

import { formatCurrency } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { KehadiranBadge } from './KehadiranBadge'
import { RowActions } from './RowActions'
import { formatShortDate, TIPE_ORDER_LABEL, type JadwalListRow as Row } from './types'

interface Props {
  row: Row
  no: number
  onRemind: (row: Row) => void
  onCancel: (row: Row) => void | Promise<void>
}

const td = 'px-4 py-3 align-top text-sm text-foreground'

export function JadwalListRow({ row, no, onRemind, onCancel }: Props) {
  return (
    <tr className="border-b border-border/50 hover:bg-primary/5 transition-colors">
      <td className={td}>{no}</td>
      <td className={`${td} whitespace-nowrap`}>{formatShortDate(row.visit_date)}</td>
      <td className={`${td} whitespace-nowrap`}>{row.visit_time ?? '—'}</td>
      <td className={td}>
        <button
          onClick={() => window.open(`/patients/${row.patient_id}/visits`, '_blank', 'noopener,noreferrer')}
          className="text-primary font-medium hover:underline cursor-pointer text-left"
        >
          {row.patient_name}
        </button>
      </td>
      <td className={td}>{row.patient_age ?? '—'}</td>
      <td className={td}>{row.chief_complaint || '—'}</td>
      <td className={td}>{row.attending_staff_name ?? '—'}</td>
      <td className={td}>{TIPE_ORDER_LABEL}</td>
      <td className={td}>{row.service_type ?? '—'}</td>
      <td className={td}>{row.pertemuan_ke}</td>
      <td className={`${td} whitespace-nowrap`}>{formatCurrency(row.kurang_bayar)}</td>
      <td className={td}><KehadiranBadge kehadiran={row.kehadiran} /></td>
      <td className={td}><StatusBadge status={row.admin_status} /></td>
      <td className={td}>{row.notes || '—'}</td>
      <td className={td}>
        <RowActions row={row} onRemind={onRemind} onCancel={onCancel} />
      </td>
    </tr>
  )
}
