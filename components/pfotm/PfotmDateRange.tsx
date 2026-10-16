'use client'

import { useState } from 'react'
import { CalendarRange, Check, Loader2 } from 'lucide-react'
import { MONTH_NAMES } from '@/lib/payroll/period'
import { datesBetween } from '@/lib/metrics/achievement'
import { btn } from '@/components/payroll/Modal'

interface Range { start: string; end: string }

interface Props {
  year: number
  month: number
  start: string
  end: string
  workingDays: number
  /** Payroll window (27 → 26 by default) for this branch-month; null while loading. */
  payrollWindow: Range | null
  editable: boolean
  busy: boolean
  /** null = back to the payroll window */
  onChange: (range: Range | null) => void
}

const fmt = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

function calendarMonth(year: number, month: number): Range {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` }
}

/** Which dates the PFOTM numbers cover, with presets matching Progress Target's two modes. */
export function PfotmDateRange(p: Props) {
  const [draft, setDraft] = useState<Range | null>(null)
  const cal = calendarMonth(p.year, p.month)
  const current = { start: p.start, end: p.end }
  const shown = draft ?? current
  const same = (a: Range | null, b: Range) => !!a && a.start === b.start && a.end === b.end
  const mode = same(p.payrollWindow, current) ? 'Periode gaji' : same(cal, current) ? 'Bulan kalender' : 'Kustom'
  const dirty = !!draft && !same(draft, current)
  const invalid = !!draft && draft.end < draft.start

  const presets: { label: string; range: Range | null; apply: Range | null }[] = [
    { label: 'Periode gaji', range: p.payrollWindow, apply: null },
    { label: 'Bulan kalender', range: cal, apply: cal },
  ]

  function apply(range: Range | null) {
    setDraft(null)
    p.onChange(range)
  }

  return (
    <div className="w-full rounded-xl border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange size={15} className="text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground">Rentang data</span>
        <span className="text-sm text-foreground">{fmt(p.start)} – {fmt(p.end)}</span>
        <span className="text-xs text-muted-foreground">
          · {datesBetween(p.start, p.end).length} hari · {p.workingDays} hari kerja
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          mode === 'Kustom' ? 'bg-secondary/15 text-secondary-foreground' : 'bg-primary/10 text-primary'
        }`}>{mode}</span>
        {p.busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </div>

      {p.editable && (
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((pr) => (
            <button
              key={pr.label}
              disabled={p.busy || !pr.range || same(pr.range, current)}
              onClick={() => apply(pr.apply)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:cursor-default ${
                pr.range && same(pr.range, current)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              }`}
            >
              {pr.label}
              {pr.range && <span className="opacity-70"> · {fmt(pr.range.start)} – {fmt(pr.range.end)}</span>}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-1">atau atur sendiri:</span>
          <input
            type="date" value={shown.start} max={shown.end} disabled={p.busy}
            onChange={(e) => e.target.value && setDraft({ ...shown, start: e.target.value })}
            className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
            aria-label="Tanggal mulai"
          />
          <span className="text-xs text-muted-foreground">s/d</span>
          <input
            type="date" value={shown.end} min={shown.start} disabled={p.busy}
            onChange={(e) => e.target.value && setDraft({ ...shown, end: e.target.value })}
            className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
            aria-label="Tanggal akhir"
          />
          {dirty && (
            <>
              <button className={btn.primary} disabled={p.busy || invalid} onClick={() => apply(draft)}>
                <Check size={14} /> Terapkan
              </button>
              <button className={btn.ghost} onClick={() => setDraft(null)}>Batal</button>
            </>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Semua angka otomatis (absensi, kunjungan, paket, visit, rujukan) dihitung pada rentang ini untuk PFOTM {MONTH_NAMES[p.month - 1]} {p.year}.
        Untuk mencocokkan dengan Progress Target, pilih mode yang sama di kedua halaman.
      </p>
    </div>
  )
}
