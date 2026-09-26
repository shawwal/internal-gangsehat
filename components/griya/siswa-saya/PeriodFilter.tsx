'use client'

import { CalendarRange } from 'lucide-react'
import { RANGE_PRESETS, periodLabel, type Period, type PeriodMode } from './period'
import { inputCls } from './constants'

const MODES: { key: PeriodMode; label: string }[] = [
  { key: 'month', label: 'Bulan ini' },
  { key: 'range', label: 'Rentang' },
  { key: 'all', label: 'Semua waktu' },
]

export function PeriodFilter({ value, onChange, today }: {
  value: Period; onChange: (p: Period) => void; today: string
}) {
  function setMode(mode: PeriodMode) {
    // Seed an empty range with the last 30 days so "Rentang" shows data immediately.
    if (mode === 'range' && !value.from && !value.to && today) onChange({ mode, ...RANGE_PRESETS[1].get(today) })
    else onChange({ ...value, mode })
  }

  return (
    <div className="glass-card p-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div role="tablist" aria-label="Periode" className="grid grid-cols-3 p-1 rounded-xl bg-muted/60 sm:w-auto">
          {MODES.map((m) => (
            <button key={m.key} role="tab" aria-selected={value.mode === m.key} onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                value.mode === m.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarRange size={13} className="text-primary" />
          <span className="font-medium text-foreground">{periodLabel(value, today)}</span>
        </p>
      </div>

      {value.mode === 'range' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Dari</span>
              <input type="date" value={value.from} max={value.to || undefined}
                onChange={(e) => onChange({ ...value, from: e.target.value })} className={`w-full ${inputCls}`} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Sampai</span>
              <input type="date" value={value.to} min={value.from || undefined}
                onChange={(e) => onChange({ ...value, to: e.target.value })} className={`w-full ${inputCls}`} />
            </label>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {RANGE_PRESETS.map((p) => {
              const r = today ? p.get(today) : null
              const active = !!r && r.from === value.from && r.to === value.to
              return (
                <button key={p.label} disabled={!r} onClick={() => r && onChange({ mode: 'range', ...r })}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap transition-colors cursor-pointer ${
                    active ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}>
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
