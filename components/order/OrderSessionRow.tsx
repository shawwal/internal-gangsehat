'use client'

import { Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { inputCls } from './constants'
import type { SessionRow, TherapistOption } from './types'

const fieldCls = 'w-full px-2.5 py-2 border border-border rounded-lg text-xs bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-shadow'

interface Props {
  variant: 'table' | 'card'
  session: SessionRow
  therapists: TherapistOption[]
  canRemove: boolean
  onChange: (patch: Partial<SessionRow>) => void
  onRemove: () => void
}

export function OrderSessionRow({ variant, session, therapists, canRemove, onChange, onRemove }: Props) {
  const dateInput = (
    <input
      type="date"
      value={session.tanggal}
      onChange={(e) => onChange({ tanggal: e.target.value })}
      className={variant === 'table' ? fieldCls : inputCls}
    />
  )
  const timeInput = (
    <input
      type="time"
      value={session.jam}
      onChange={(e) => onChange({ jam: e.target.value })}
      className={variant === 'table' ? fieldCls : inputCls}
    />
  )
  const therapistSelect = (
    <select
      value={session.therapist_id}
      onChange={(e) => onChange({ therapist_id: e.target.value })}
      className={`${variant === 'table' ? fieldCls : inputCls} cursor-pointer`}
    >
      <option value="">— Fisioterapis —</option>
      {therapists.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )

  if (variant === 'table') {
    return (
      <tr className="border-b border-border/50 last:border-0">
        <td className="px-3 py-2.5 text-xs font-semibold text-foreground whitespace-nowrap">Ke-{session.session_number}</td>
        <td className="px-3 py-2.5">{dateInput}</td>
        <td className="px-3 py-2.5 w-32">{timeInput}</td>
        <td className="px-3 py-2.5">{therapistSelect}</td>
        <td className="px-3 py-2.5 text-center w-10">
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label={`Hapus pertemuan ke-${session.session_number}`}
          >
            <Trash2 size={13} />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          Pertemuan Ke-{session.session_number}
          {session.tanggal && (
            <span className="text-muted-foreground font-normal ml-1.5">· {formatDate(session.tanggal)}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label={`Hapus pertemuan ke-${session.session_number}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {dateInput}
        {timeInput}
      </div>
      {therapistSelect}
    </div>
  )
}
