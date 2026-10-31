'use client'

import { useState } from 'react'
import { shortDayLabel } from '@/lib/payroll/period'
import type { PayrollWorkspace } from '@/lib/payroll/workspace'
import { Modal, btn, inputCls, labelCls } from './Modal'

interface Props {
  ws: PayrollWorkspace
  onToggleDay: (date: string, workday: boolean, note: string | null) => Promise<void>
  onChangeRange: (start: string, end: string) => Promise<void>
}

export function CalendarStep({ ws, onToggleDay, onChangeRange }: Props) {
  const { period, permissions } = ws
  const [editing, setEditing] = useState<{ date: string; workday: boolean; note: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [range, setRange] = useState({ start: period.start_date, end: period.end_date })
  const [savingRange, setSavingRange] = useState(false)
  const canEditRange = permissions.canEdit && period.status === 'draft'
  const rangeChanged = range.start !== period.start_date || range.end !== period.end_date

  async function saveRange() {
    setSavingRange(true)
    await onChangeRange(range.start, range.end)
    setSavingRange(false)
  }

  // Pad the grid so the first day lands under its weekday column (Senin first).
  const firstDow = (new Date(`${period.start_date}T00:00:00Z`).getUTCDay() + 6) % 7
  const cells: (typeof period.days[number] | null)[] = [...Array(firstDow).fill(null), ...period.days]

  async function save() {
    if (!editing) return
    setSaving(true)
    await onToggleDay(editing.date, editing.workday, editing.note || null)
    setSaving(false)
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className={labelCls}>Tanggal mulai</label>
          <input type="date" className={inputCls} value={range.start} disabled={!canEditRange}
            onChange={(e) => setRange({ ...range, start: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Tanggal selesai</label>
          <input type="date" className={inputCls} value={range.end} disabled={!canEditRange}
            onChange={(e) => setRange({ ...range, end: e.target.value })} />
        </div>
        {canEditRange && rangeChanged && (
          <>
            <button className={btn.primary} onClick={saveRange} disabled={savingRange}>
              {savingRange ? 'Menyimpan…' : 'Simpan periode'}
            </button>
            <button className={btn.secondary} onClick={() => setRange({ start: period.start_date, end: period.end_date })}>Batal</button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="px-3 py-2 rounded-xl bg-primary/10 text-primary font-semibold">
          {period.workdays} hari kerja
        </div>
        <span className="text-muted-foreground">
          {period.days.length} hari kalender · libur mingguan: {ws.settings.weekly_off_days.join(', ') || '—'}
        </span>
        {permissions.canEdit && (
          <span className="text-xs text-muted-foreground">Klik tanggal untuk menandai hari kerja / libur.</span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />
          const dayNum = Number(d.date.slice(8))
          return (
            <button
              key={d.date}
              type="button"
              disabled={!permissions.canEdit}
              onClick={() => setEditing({ date: d.date, workday: d.workday, note: d.note ?? '' })}
              className={`min-w-0 overflow-hidden rounded-lg sm:rounded-xl border p-1 sm:p-2 text-left min-h-[56px] sm:min-h-[64px] transition disabled:cursor-default ${
                d.workday
                  ? 'border-chart-4/30 bg-chart-4/5 hover:bg-chart-4/10'
                  : 'border-border bg-muted/40 hover:bg-muted'
              }`}
              title={d.note ?? (d.workday ? 'Hari kerja' : 'Libur')}
            >
              <div className="flex items-baseline justify-between">
                <span className={`text-sm font-semibold ${d.workday ? 'text-foreground' : 'text-muted-foreground'}`}>{dayNum}</span>
                <span className="hidden sm:inline text-[9px] text-muted-foreground">{shortDayLabel(d.date)}</span>
              </div>
              <p className={`text-[9px] sm:text-[10px] mt-1 leading-tight truncate ${d.workday ? 'text-chart-4' : 'text-muted-foreground'}`}>
                {d.workday ? 'Kerja' : (d.note ?? 'Libur')}
              </p>
            </button>
          )
        })}
      </div>

      {editing && (
        <Modal
          title={new Date(`${editing.date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
          onClose={() => setEditing(null)}
          size="sm"
          footer={
            <>
              <button className={btn.secondary} onClick={() => setEditing(null)}>Batal</button>
              <button className={btn.primary} onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              {[true, false].map((w) => (
                <button
                  key={String(w)}
                  type="button"
                  onClick={() => setEditing({ ...editing, workday: w })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${
                    editing.workday === w ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                  }`}
                >
                  {w ? 'Hari kerja' : 'Libur'}
                </button>
              ))}
            </div>
            <div>
              <label className={labelCls}>Keterangan (opsional)</label>
              <input
                className={inputCls}
                value={editing.note}
                placeholder="mis. Libur Maulid Nabi"
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
