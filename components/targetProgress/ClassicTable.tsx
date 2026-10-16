'use client'

import Link from 'next/link'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { formatPct, progressColor } from './utils'
import type { CategoryKey, CategorySummary } from './types'

interface ClassicTableProps {
  summaries: CategorySummary[]
  /** ISO dates of the window, one column each (calendar month or payroll period) */
  dates: string[]
  monthLabel: string
  branchId: string
  /** This page's own query (branch/month/mode) — the detail page links back to it. */
  backQuery: string
}

export function ClassicTable({ summaries, dates, monthLabel, branchId, backQuery }: ClassicTableProps) {
  // Column header = day of month; the payroll window crosses a month boundary,
  // so headers can run 27 … 31, 1 … 26.
  const dayNumbers = dates.map((d) => Number(d.slice(8, 10)))

  // A day cell lists that day; Capaian lists the whole window.
  function detailHref(category: CategoryKey, start: string, end: string = start) {
    return `/target-progress/detail?${new URLSearchParams({ branch: branchId, category, start, end, back: backQuery })}`
  }

  function handleExport() {
    type Row = Record<string, string | number>
    const rows: Row[] = summaries.map(s => {
      const row: Row = {
        Kategori: s.label,
        Target: s.target,
        Capaian: s.actual,
        Selisih: s.selisih,
        Progress: formatPct(s.actual, s.target),
      }
      dates.forEach((d, i) => { row[d] = s.daily[i] ?? 0 })
      return row
    })
    const cols: ExportColumn<Row>[] = [
      { header: 'Kategori', value: r => r['Kategori'] },
      { header: 'Target', value: r => r['Target'] },
      { header: 'Capaian', value: r => r['Capaian'] },
      { header: 'Selisih', value: r => r['Selisih'] },
      { header: 'Progress', value: r => r['Progress'] },
      ...dates.map(d => ({ header: d, value: (r: Row) => r[d] })),
    ]
    exportToExcel(rows, cols, `progress_target_${monthLabel.replace(' ', '_')}`)
    return Promise.resolve()
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-end">
        <ExportButton onExport={handleExport} label="Export" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-border rounded-2xl overflow-hidden bg-card border-separate border-spacing-0">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground sticky left-0 bg-muted/50 min-w-[110px] border-b border-border">KATEGORI</th>
              <th className="px-2 py-2.5 font-semibold text-muted-foreground text-right min-w-[60px] border-b border-border">TARGET</th>
              <th className="px-2 py-2.5 font-semibold text-muted-foreground text-right min-w-[60px] border-b border-border">CAPAIAN</th>
              <th className="px-2 py-2.5 font-semibold text-muted-foreground text-right min-w-[60px] border-b border-border">SELISIH</th>
              <th className="px-2 py-2.5 font-semibold text-muted-foreground text-right min-w-[70px] border-b border-border">PROGRESS</th>
              {dayNumbers.map((d, i) => (
                <th key={dates[i]} className="px-1 py-2.5 font-medium text-muted-foreground text-center min-w-[28px] border-b border-border">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => {
              const pct = s.target ? (s.actual / s.target) * 100 : null
              return (
                <tr key={s.key} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-bold sticky left-0 bg-card border-r border-border" style={{ color: 'var(--secondary)' }}>
                    {s.label}
                  </td>
                  <td className="px-2 py-2 text-right text-foreground">{s.target.toLocaleString('id-ID')}</td>
                  <td
                    className={`px-2 py-2 text-right ${s.actual > 0 ? 'font-semibold' : 'text-foreground'}`}
                    style={s.actual > 0 ? { color: 'var(--chart-5)' } : undefined}
                  >
                    {s.actual > 0 ? (
                      <Link href={detailHref(s.key, dates[0], dates[dates.length - 1])} prefetch={false} className="hover:underline">
                        {s.actual.toLocaleString('id-ID')}
                      </Link>
                    ) : s.actual.toLocaleString('id-ID')}
                  </td>
                  <td
                    className="px-2 py-2 text-right font-semibold"
                    style={{ color: s.selisih < 0 ? 'var(--destructive)' : 'var(--chart-4)' }}
                  >
                    {s.selisih > 0 ? '+' : ''}{s.selisih.toLocaleString('id-ID')}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold" style={{ color: progressColor(pct) }}>
                    {formatPct(s.actual, s.target)}
                  </td>
                  {s.daily.map((v, i) => (
                    <td
                      key={i}
                      className="px-1 py-2 text-center font-medium"
                      style={{ color: v > 0 ? 'var(--chart-5)' : 'var(--muted-foreground)' }}
                    >
                      {v > 0 ? (
                        <Link href={detailHref(s.key, dates[i])} prefetch={false} className="block hover:underline">{v}</Link>
                      ) : v}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
