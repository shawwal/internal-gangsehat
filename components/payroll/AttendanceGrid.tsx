'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Wand2 } from 'lucide-react'
import { formatCode, parseCodeInput } from '@/lib/payroll/attendance'
import { shortDayLabel } from '@/lib/payroll/period'
import type { AttendanceCode } from '@/lib/payroll/types'
import { staffDisplayName, type PayrollWorkspace, type WorkspaceRow } from '@/lib/payroll/workspace'
import { CODE_STYLE } from './format'
import { avgOf, formatStat, sumOf } from '@/lib/tableStats'
import { btn } from './Modal'

export interface CellChange {
  staffId: string
  date: string
  code: AttendanceCode | null
}

interface Props {
  ws: PayrollWorkspace
  rows: WorkspaceRow[]
  onChange: (changes: CellChange[]) => void
}

function cellStyle(code: AttendanceCode | null): string {
  if (code === null) return 'bg-transparent text-muted-foreground'
  if (typeof code === 'number') return CODE_STYLE.LATE
  return CODE_STYLE[code]
}

export function AttendanceGrid({ ws, rows, onChange }: Props) {
  const { period, permissions } = ws
  const editable = permissions.canEdit
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [invalid, setInvalid] = useState<string | null>(null)
  const gridRef = useRef<HTMLTableElement>(null)

  const key = (staffId: string, date: string) => `${staffId}|${date}`

  function commit(staffId: string, date: string, raw: string) {
    const k = key(staffId, date)
    const parsed = parseCodeInput(raw)
    if (parsed === undefined) {
      setInvalid(k)
      return
    }
    setInvalid(null)
    setDrafts((d) => {
      const next = { ...d }
      delete next[k]
      return next
    })
    const current = ws.attendance[staffId]?.[date] ?? null
    if (parsed !== current) onChange([{ staffId, date, code: parsed }])
  }

  function focusCell(row: number, col: number) {
    const el = gridRef.current?.querySelector<HTMLInputElement>(`input[data-r="${row}"][data-c="${col}"]`)
    el?.focus()
    el?.select()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0], Enter: [1, 0],
    }
    const mv = moves[e.key]
    if (!mv) return
    e.preventDefault()
    ;(e.target as HTMLInputElement).blur()
    focusCell(r + mv[0], c + mv[1])
  }

  /** Batch: mark every empty workday as H. */
  function fillPresent(staffId?: string) {
    const changes: CellChange[] = []
    for (const s of ws.staff) {
      if (staffId && s.id !== staffId) continue
      for (const d of period.days) {
        if (d.workday && ws.attendance[s.id]?.[d.date] === undefined) changes.push({ staffId: s.id, date: d.date, code: 'H' })
      }
    }
    if (changes.length) onChange(changes)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {[
            ['H', 'Hadir'], ['5', 'Angka = menit terlambat'], ['I', 'Izin'], ['S', 'Sakit'], ['C', 'Cuti'], ['A', 'Alfa'],
          ].map(([c, label]) => (
            <span key={c} className={`px-2 py-0.5 rounded-full font-medium ${/\d/.test(c) ? CODE_STYLE.LATE : CODE_STYLE[c]}`}>
              <b>{c}</b> {label}
            </span>
          ))}
        </div>
        {editable && (
          <button className={btn.secondary} onClick={() => fillPresent()}>
            <Wand2 size={14} /> Isi &quot;H&quot; untuk hari kerja yang kosong
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table ref={gridRef} className="text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium text-muted-foreground min-w-[150px]">Karyawan</th>
              {period.days.map((d) => (
                <th key={d.date} className={`px-0.5 py-1 text-center font-medium min-w-[34px] ${d.workday ? 'text-muted-foreground' : 'text-muted-foreground/50 bg-muted/60'}`}>
                  <div className="text-[9px]">{shortDayLabel(d.date)}</div>
                  <div>{Number(d.date.slice(8))}</div>
                </th>
              ))}
              {['HADIR', 'TLBT', 'IZIN', 'SAKIT', 'CUTI', 'ALFA'].map((h) => (
                <th key={h} className="px-2 py-2 text-center font-semibold text-muted-foreground border-l border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const s = row.staff
              const a = row.attendance
              const attWarn = row.warnings.filter((w) => w.field === 'attendance' || w.field === 'late')
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1 border-r border-border">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground truncate max-w-[120px]" title={s.full_name}>{staffDisplayName(s)}</span>
                      {attWarn.length > 0 && (
                        <span title={attWarn.map((w) => w.message).join('\n')}>
                          <AlertTriangle size={12} className="text-secondary shrink-0" />
                        </span>
                      )}
                    </div>
                    {editable && (
                      <button className="text-[10px] text-primary hover:underline" onClick={() => fillPresent(s.id)}>isi H</button>
                    )}
                  </td>
                  {period.days.map((d, c) => {
                    const k = key(s.id, d.date)
                    const code = ws.attendance[s.id]?.[d.date] ?? null
                    const value = drafts[k] ?? formatCode(code)
                    return (
                      <td key={d.date} className={`p-0.5 text-center ${d.workday ? '' : 'bg-muted/40'}`}>
                        <input
                          data-r={r}
                          data-c={c}
                          value={value}
                          disabled={!editable}
                          maxLength={3}
                          aria-label={`${s.full_name} ${d.date}`}
                          onChange={(e) => setDrafts((dr) => ({ ...dr, [k]: e.target.value }))}
                          onBlur={(e) => { if (drafts[k] !== undefined) commit(s.id, d.date, e.target.value) }}
                          onKeyDown={(e) => onKeyDown(e, r, c)}
                          onFocus={(e) => e.target.select()}
                          className={`w-8 h-7 rounded-md text-center font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-default ${
                            invalid === k ? 'ring-2 ring-destructive' : ''
                          } ${cellStyle(code)}`}
                        />
                      </td>
                    )
                  })}
                  {[a.hadir, a.lateMinutes, a.izin, a.sakit, a.cuti, a.alfa].map((v, i) => (
                    <td key={i} className={`px-2 text-center font-semibold border-l border-border ${
                      i === 5 && v > 0 ? 'text-destructive' : i === 1 && v > 0 ? 'text-secondary-foreground' : 'text-foreground'
                    }`}>{v}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-border bg-muted/30 font-semibold text-foreground">
              {(['Jumlah', 'Rata-rata'] as const).map((label) => {
                const stat = label === 'Jumlah' ? sumOf : avgOf
                return (
                  <tr key={label} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border">{label}</td>
                    <td colSpan={period.days.length} />
                    {(['hadir', 'lateMinutes', 'izin', 'sakit', 'cuti', 'alfa'] as const).map((k) => (
                      <td key={k} className="px-2 py-1.5 text-center border-l border-border">
                        {formatStat(stat(rows.map((r) => r.attendance[k])))}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tfoot>
          )}
        </table>
      </div>
      {invalid && (
        <p className="text-xs text-destructive">Isi dengan H, I, S, C, A, atau angka menit terlambat (0–600).</p>
      )}
      <p className="text-xs text-muted-foreground">
        Tips: ketik kode lalu tekan Enter/panah untuk pindah sel. Perubahan tersimpan otomatis.
      </p>
    </div>
  )
}
