'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { staffDisplayName, type PayrollWorkspace, type WorkspaceRow } from '@/lib/payroll/workspace'
import { formatIDR } from './format'
import { btn } from './Modal'

interface Props {
  ws: PayrollWorkspace
  rows: WorkspaceRow[]
  refreshing: boolean
  onRefresh: () => void
  onOverride: (staffId: string, code: string, value: number | null) => void
}

export function ActivityStep({ ws, rows, refreshing, onRefresh, onOverride }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const editable = ws.permissions.canEdit

  // Columns: types somebody is paid on (incentive codes / rates) or that have data.
  const columns = useMemo(() => {
    const used = new Set<string>()
    for (const s of ws.staff) {
      s.compensation?.incentive_activity_codes.forEach((c) => used.add(c))
      Object.entries(s.compensation?.activity_rates ?? {}).forEach(([c, v]) => { if (v) used.add(c) })
      Object.entries(ws.activity[s.id] ?? {}).forEach(([c, cell]) => { if ((cell.override ?? cell.auto) > 0) used.add(c) })
    }
    return ws.activityTypes.filter((t) => showAll || used.has(t.code))
  }, [ws, showAll])

  const groups = useMemo(() => {
    const out: { label: string; span: number }[] = []
    for (const c of columns) {
      const last = out[out.length - 1]
      if (last && last.label === c.group_label) last.span++
      else out.push({ label: c.group_label, span: 1 })
    }
    return out
  }, [columns])

  function commit(staffId: string, code: string, raw: string, auto: number) {
    const k = `${staffId}|${code}`
    setDrafts((d) => { const next = { ...d }; delete next[k]; return next })
    const trimmed = raw.trim()
    if (trimmed === '') return onOverride(staffId, code, null)
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return
    onOverride(staffId, code, n === auto ? null : n)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-2xl">
          Angka otomatis diambil dari kunjungan pasien yang <b>hadir</b> (Jadwal Harian) dalam periode ini.
          Ketik angka untuk mengoreksi; kosongkan untuk kembali ke nilai otomatis.
        </p>
        <div className="flex gap-2">
          <button className={btn.ghost} onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Sembunyikan kolom kosong' : 'Tampilkan semua aktivitas'}
          </button>
          {editable && (
            <button className={btn.secondary} onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Tarik ulang data sesi
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted" />
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary border-l border-border">{g.label}</th>
              ))}
              <th colSpan={3} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary border-l border-border">Hasil</th>
            </tr>
            <tr className="bg-muted/50 border-b border-border">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium text-muted-foreground min-w-[150px]">Karyawan</th>
              {columns.map((t) => (
                <th key={t.code} className="px-2 py-2 text-center font-medium text-muted-foreground border-l border-border min-w-[78px]" title={t.code}>
                  {t.label}
                  <div className="text-[9px] font-normal opacity-70">{t.count_mode === 'manual' ? 'manual' : 'otomatis'}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium text-muted-foreground border-l border-border">Capaian</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Insentif</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">Bonus Visit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const s = row.staff
              const comp = s.compensation
              const insentif = row.result?.lines.find((l) => l.code === 'INSENTIF')?.amount ?? 0
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border">
                    <div className="font-medium text-foreground truncate max-w-[140px]" title={s.full_name}>{staffDisplayName(s)}</div>
                    <div className="text-[10px] text-muted-foreground">{s.jabatan ?? s.role}</div>
                  </td>
                  {columns.map((t) => {
                    const cell = ws.activity[s.id]?.[t.code]
                    const auto = cell?.auto ?? 0
                    const value = cell?.override ?? auto
                    const k = `${s.id}|${t.code}`
                    const over = value > t.max_per_period
                    const relevant = comp?.incentive_activity_codes.includes(t.code) || !!comp?.activity_rates[t.code]
                    return (
                      <td key={t.code} className={`px-1 py-1 text-center border-l border-border ${relevant ? '' : 'opacity-50'}`}>
                        <input
                          inputMode="numeric"
                          disabled={!editable}
                          value={drafts[k] ?? String(value)}
                          aria-label={`${s.full_name} ${t.label}`}
                          onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value.replace(/[^\d]/g, '') }))}
                          onBlur={(e) => { if (drafts[k] !== undefined) commit(s.id, t.code, e.target.value, auto) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          onFocus={(e) => e.target.select()}
                          title={over ? `Melebihi batas wajar (${t.max_per_period})` : undefined}
                          className={`w-14 h-7 rounded-md text-center font-semibold border focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-default ${
                            over ? 'border-destructive bg-destructive/10 text-destructive'
                              : cell?.override != null ? 'border-secondary bg-secondary/10 text-foreground'
                              : 'border-transparent bg-muted/40 text-foreground'
                          }`}
                        />
                        {cell?.override != null && (
                          <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground mt-0.5">
                            oto: {auto}
                            {editable && (
                              <button title="Kembalikan ke otomatis" onClick={() => onOverride(s.id, t.code, null)} className="hover:text-primary">
                                <RotateCcw size={9} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 text-center border-l border-border text-muted-foreground whitespace-nowrap">
                    {comp && comp.incentive_target > 0 ? `${row.result?.incentiveQty ?? 0}/${comp.incentive_target}` : '—'}
                  </td>
                  <td className="px-2 text-right font-semibold text-foreground whitespace-nowrap">{formatIDR(insentif)}</td>
                  <td className="px-2 text-right font-semibold text-foreground whitespace-nowrap">{formatIDR(row.result?.visit ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Kolom kuning = dikoreksi manual · merah = melebihi batas wajar · kolom pudar = tidak dipakai di skema gaji karyawan tsb.
      </p>
    </div>
  )
}
