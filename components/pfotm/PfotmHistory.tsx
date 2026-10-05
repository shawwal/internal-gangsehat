'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Crown, Trophy } from 'lucide-react'
import type { PfotmHistoryRow } from '@/app/actions/pfotm'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { MONTH_NAMES } from '@/lib/payroll/period'
import { ExportButton } from '@/components/ui/ExportButton'

interface Props {
  year: number
  history: PfotmHistoryRow[]
}

const pct = (n: number | undefined) => (n === undefined ? '—' : `${(n * 100).toFixed(0)}%`)
const METRIC_COLS: [string, string][] = [
  ['hadir', 'Hadir'], ['terlambat', 'Telat'], ['alfa', 'Alfa'], ['kunjungan', 'Kunj.'], ['paket_1', 'P1'], ['paket_2', 'P2'],
  ['paket_3', 'P3'], ['ta_sesi_visit', 'TA/Sesi V'], ['paket_visit', 'Pkt V'], ['rujukan_sm', 'Rujukan'], ['kegiatan_external', 'Ext'],
]

/** Rekap Data + Rekap Poin + Daftar Pemenang, generated from locked periods. */
export function PfotmHistory({ year, history }: Props) {
  const champions = useMemo(() => {
    const count = new Map<string, number>()
    for (const m of history) {
      const champ = m.entries[0]
      if (champ) count.set(champ.name, (count.get(champ.name) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1])
  }, [history])

  const yearly = useMemo(() => {
    const agg = new Map<string, { name: string; points: number; months: number; hadir: number; hk: number; late: number; visits: number }>()
    for (const m of history) {
      for (const e of m.entries) {
        const a = agg.get(e.name) ?? { name: e.name, points: 0, months: 0, hadir: 0, hk: 0, late: 0, visits: 0 }
        a.points += e.total_points
        a.months++
        a.hadir += e.metrics.hadir ?? 0
        a.hk += m.working_days
        a.late += e.metrics.terlambat ?? 0
        a.visits += e.metrics.kunjungan ?? 0
        agg.set(e.name, a)
      }
    }
    return [...agg.values()].sort((a, b) => b.points - a.points)
  }, [history])

  function handleExport() {
    type Row = { month: number; wd: number } & PfotmHistoryRow['entries'][number]
    const rows: Row[] = history.flatMap((m) => m.entries.map((e) => ({ ...e, month: m.period_month, wd: m.working_days })))
    const cols: ExportColumn<Row>[] = [
      { header: 'Periode', value: (r) => MONTH_NAMES[r.month - 1] },
      { header: 'Nama', value: (r) => r.name },
      ...METRIC_COLS.map(([k, l]) => ({ header: l, value: (r: Row) => r.metrics[k] ?? 0 })),
      { header: 'Hari Kerja', value: (r) => r.wd },
      { header: '% Kehadiran', value: (r) => Number(((r.kpis.kehadiran ?? 0) * 100).toFixed(1)) },
      { header: '% Disiplin', value: (r) => Number(((r.kpis.disiplin ?? 0) * 100).toFixed(1)) },
      { header: 'Kunj. per Hadir', value: (r) => Number((r.kpis.kunjungan_per_hadir ?? 0).toFixed(2)) },
      { header: 'Total Poin', value: (r) => r.total_points },
      { header: 'Rank', value: (r) => r.rank },
    ]
    exportToExcel(rows, cols, `Rekap_PFOTM_${year}`)
    return Promise.resolve()
  }

  if (!history.length) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Belum ada periode terkunci di {year}.</div>
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Juara per bulan</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const row = history.find((h) => h.period_month === m)
              const champ = row?.entries[0]
              return (
                <div key={m} className={`rounded-xl p-2.5 text-center border ${champ ? 'border-[#F5C542]/40 bg-[#F5C542]/10' : 'border-border bg-muted/30'}`}>
                  <p className="text-[10px] text-muted-foreground">{MONTH_NAMES[m - 1].slice(0, 3)}</p>
                  {champ ? (
                    <>
                      <Crown size={14} className="mx-auto text-[#E3A90F] my-0.5" />
                      <p className="text-xs font-bold text-foreground truncate">{champ.name}</p>
                      <p className="text-[10px] text-muted-foreground">{champ.total_points} poin</p>
                    </>
                  ) : <p className="text-xs text-muted-foreground mt-3">—</p>}
                </div>
              )
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Trophy size={14} className="text-[#E3A90F]" /> Daftar Pemenang {year}</p>
          <div className="space-y-2">
            {champions.map(([name, n], i) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 text-sm font-medium text-foreground">{name}</span>
                <span className="text-sm font-bold text-primary">{n}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Akumulasi poin {year}</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="points" name="Total poin" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="py-1.5 text-left font-medium">Nama</th>
                <th className="py-1.5 text-right font-medium">Bulan</th>
                <th className="py-1.5 text-right font-medium">Total poin</th>
                <th className="py-1.5 text-right font-medium">% Kehadiran</th>
                <th className="py-1.5 text-right font-medium">% Disiplin</th>
                <th className="py-1.5 text-right font-medium">Kunj. per hadir</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((y) => (
                <tr key={y.name} className="border-b border-border last:border-0">
                  <td className="py-1.5 font-medium text-foreground">{y.name}</td>
                  <td className="py-1.5 text-right">{y.months}</td>
                  <td className="py-1.5 text-right font-semibold">{y.points}</td>
                  <td className="py-1.5 text-right">{pct(y.hk ? y.hadir / y.hk : 0)}</td>
                  <td className="py-1.5 text-right">{pct(y.hadir ? (y.hadir - y.late) / y.hadir : 0)}</td>
                  <td className="py-1.5 text-right">{y.hadir ? (y.visits / y.hadir).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Rekap data per bulan</p>
        <ExportButton onExport={handleExport} />
      </div>
      {history.slice().reverse().map((m) => (
        <div key={m.period_month} className="rounded-2xl border border-border bg-card overflow-x-auto">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold text-foreground">
            {MONTH_NAMES[m.period_month - 1]} <span className="text-xs font-normal text-muted-foreground">· {m.working_days} hari kerja</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground bg-muted/30">
                <th className="px-2 py-1.5 text-left font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Nama</th>
                {METRIC_COLS.map(([k, l]) => <th key={k} className="px-2 py-1.5 text-right font-medium">{l}</th>)}
                <th className="px-2 py-1.5 text-right font-medium">% Hadir</th>
                <th className="px-2 py-1.5 text-right font-medium">% Disiplin</th>
                <th className="px-2 py-1.5 text-right font-medium">Kunj/Hadir</th>
                <th className="px-2 py-1.5 text-right font-semibold">Poin</th>
              </tr>
            </thead>
            <tbody>
              {m.entries.map((e) => (
                <tr key={e.name} className="border-t border-border">
                  <td className="px-2 py-1.5 font-bold text-muted-foreground">{e.rank}</td>
                  <td className="px-2 py-1.5 font-medium text-foreground">{e.name}</td>
                  {METRIC_COLS.map(([k]) => <td key={k} className="px-2 py-1.5 text-right">{e.metrics[k] ?? 0}</td>)}
                  <td className="px-2 py-1.5 text-right">{pct(e.kpis.kehadiran)}</td>
                  <td className="px-2 py-1.5 text-right">{pct(e.kpis.disiplin)}</td>
                  <td className="px-2 py-1.5 text-right">{(e.kpis.kunjungan_per_hadir ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-primary">{e.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
