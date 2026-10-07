'use client'

import { useState } from 'react'
import { EyeOff, RefreshCw, RotateCcw, UserPlus } from 'lucide-react'
import type { PfotmEntry } from '@/app/actions/pfotm'
import type { BoardRow, PointRule } from '@/lib/pfotm/engine'
import { btn } from '@/components/payroll/Modal'
import { avgOf, formatStat, sumOf } from '@/lib/tableStats'

interface Props {
  entries: PfotmEntry[]
  rules: PointRule[]
  board: BoardRow[]
  workingDays: number
  workingDaysOverride: boolean
  editable: boolean
  refreshing: boolean
  onRefresh: () => void
  onOverride: (entryId: string, key: string, value: number | null) => void
  onExclude: (entryId: string, excluded: boolean) => void
  onWorkingDays: (days: number | null) => void
  onAddParticipant: () => void
}

/** Single consolidated form replacing Kunjungan / Rujukan SM / Keuangan / Data sheets. */
export function PfotmInput(p: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [wd, setWd] = useState<string | null>(null)
  const rules = p.rules.filter((r) => r.is_active !== false)
  const rowByKey = new Map(p.board.map((r) => [r.key, r]))
  const statEntries = p.entries.filter((e) => !e.excluded)
  const metricValue = (e: PfotmEntry, key: string) => Number(e.override_metrics[key] ?? e.auto_metrics[key] ?? 0)

  function commit(e: PfotmEntry, key: string, raw: string) {
    const k = `${e.id}|${key}`
    setDrafts((d) => { const next = { ...d }; delete next[k]; return next })
    const auto = Number(e.auto_metrics[key] ?? 0)
    if (raw.trim() === '') return p.onOverride(e.id, key, null)
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0) return
    p.onOverride(e.id, key, n === auto ? null : n)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Hari kerja</span>
          <input
            type="number" min={0} max={31} disabled={!p.editable}
            value={wd ?? String(p.workingDays)}
            onChange={(e) => setWd(e.target.value)}
            onBlur={() => { if (wd !== null) { const n = Number(wd); setWd(null); if (Number.isInteger(n) && n !== p.workingDays) p.onWorkingDays(n) } }}
            className="w-16 px-2 py-1.5 rounded-lg border border-border bg-background text-center font-semibold"
            aria-label="Hari kerja"
          />
          {p.workingDaysOverride ? (
            p.editable && <button className="text-xs text-primary hover:underline" onClick={() => p.onWorkingDays(null)}>kembali ke otomatis</button>
          ) : <span className="text-xs text-muted-foreground">(otomatis dari kalender penggajian)</span>}
        </div>
        {p.editable && (
          <div className="flex gap-2">
            <button className={btn.ghost} onClick={p.onAddParticipant}><UserPlus size={14} /> Peserta</button>
            <button className={btn.secondary} onClick={p.onRefresh} disabled={p.refreshing}>
              <RefreshCw size={14} className={p.refreshing ? 'animate-spin' : ''} /> Tarik ulang data otomatis
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium min-w-[130px]">Nama</th>
              {rules.map((r) => (
                <th key={r.metric_key} className="px-1.5 py-2 text-center font-medium min-w-[68px]">
                  {r.metric_label}
                  <div className={`text-[9px] font-normal ${Number(r.weight) < 0 ? 'text-destructive' : 'opacity-70'}`}>×{Number(r.weight)}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold text-foreground border-l border-border">Total</th>
              <th className="px-2 py-2 text-center font-medium">Rank</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {p.entries.map((e) => {
              const row = rowByKey.get(e.id)
              return (
                <tr key={e.id} className={`border-b border-border last:border-0 ${e.excluded ? 'opacity-40' : 'hover:bg-muted/20'}`}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium text-foreground border-r border-border">{e.display_name}</td>
                  {rules.map((r) => {
                    const k = `${e.id}|${r.metric_key}`
                    const auto = Number(e.auto_metrics[r.metric_key] ?? 0)
                    const over = e.override_metrics[r.metric_key]
                    const value = over ?? auto
                    return (
                      <td key={r.metric_key} className="px-1 py-1 text-center">
                        <input
                          inputMode="numeric" disabled={!p.editable || e.excluded}
                          value={drafts[k] ?? String(value)}
                          aria-label={`${e.display_name} ${r.metric_label}`}
                          onChange={(ev) => setDrafts((d) => ({ ...d, [k]: ev.target.value.replace(/[^\d]/g, '') }))}
                          onBlur={(ev) => { if (drafts[k] !== undefined) commit(e, r.metric_key, ev.target.value) }}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
                          onFocus={(ev) => ev.target.select()}
                          className={`w-12 h-7 rounded-md text-center font-semibold border focus:outline-none focus:ring-2 focus:ring-primary ${
                            over != null ? 'border-secondary bg-secondary/10' : 'border-transparent bg-muted/40'
                          }`}
                        />
                        {over != null && (
                          <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground">
                            oto {r.source === 'manual' ? '—' : auto}
                            {p.editable && <button onClick={() => p.onOverride(e.id, r.metric_key, null)} title="Hapus koreksi"><RotateCcw size={9} /></button>}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 text-right font-black text-primary text-sm border-l border-border">{row ? row.total : '—'}</td>
                  <td className="px-2 text-center font-semibold">{row ? `#${row.rank}` : '—'}</td>
                  <td className="px-1">
                    {p.editable && (
                      <button className={btn.ghost} title={e.excluded ? 'Ikutkan lagi' : 'Keluarkan dari peringkat'} onClick={() => p.onExclude(e.id, !e.excluded)}>
                        <EyeOff size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {statEntries.length > 0 && (
            <tfoot className="border-t-2 border-border bg-muted/30 font-semibold text-foreground">
              {(['Jumlah', 'Rata-rata'] as const).map((label) => {
                const stat = label === 'Jumlah' ? sumOf : avgOf
                return (
                  <tr key={label} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border">{label}</td>
                    {rules.map((r) => (
                      <td key={r.metric_key} className="px-1 py-1.5 text-center">
                        {formatStat(stat(statEntries.map((e) => metricValue(e, r.metric_key))))}
                      </td>
                    ))}
                    <td className="px-2 text-right text-primary border-l border-border">
                      {formatStat(stat(statEntries.map((e) => rowByKey.get(e.id)?.total ?? 0)))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                )
              })}
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Jumlah &amp; rata-rata dihitung dari peserta yang ikut peringkat (yang dikeluarkan tidak dihitung).
        Angka otomatis: Hadir/Terlambat/Alfa dari absensi, Jumlah Kunjungan dari rekam medis yang sudah lengkap, Paket &amp; TA/Sesi Visit dari transaksi masuk LUNAS/DP, Rujukan SM dari kolom &quot;Dirujuk oleh&quot; pasien.
        Ketik untuk mengoreksi (kuning). Total & peringkat langsung dihitung ulang sebelum disimpan.
      </p>
    </div>
  )
}
