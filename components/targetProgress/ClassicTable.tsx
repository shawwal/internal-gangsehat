'use client'

import { useState } from 'react'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { DetailModal } from './DetailModal'
import { formatPct, progressColor } from './utils'
import type { CategoryKey, CategorySummary } from './types'

interface ClassicTableProps {
  summaries: CategorySummary[]
  /** ISO dates of the window, one column each (calendar month or payroll period) */
  dates: string[]
  monthLabel: string
  branchId: string
  canEdit: boolean
  onDataChanged?: () => void
}

interface DetailTarget {
  date: string
  endDate?: string
  category: CategoryKey
  label: string
}

export function ClassicTable({ summaries, dates, monthLabel, branchId, canEdit, onDataChanged }: ClassicTableProps) {
  // Column header = day of month; the payroll window crosses a month boundary,
  // so headers can run 27 … 31, 1 … 26.
  const dayNumbers = dates.map((d) => Number(d.slice(8, 10)))
  const [detail, setDetail] = useState<DetailTarget | null>(null)

  function openDetail(category: CategoryKey, label: string, index: number) {
    setDetail({ date: dates[index], category, label })
  }

  // Capaian = the whole window's list for that category.
  function openMonthDetail(category: CategoryKey, label: string) {
    setDetail({ date: dates[0], endDate: dates[dates.length - 1], category, label })
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
                    onClick={s.actual > 0 ? () => openMonthDetail(s.key, s.label) : undefined}
                    className={`px-2 py-2 text-right ${s.actual > 0 ? 'cursor-pointer hover:underline font-semibold' : 'text-foreground'}`}
                    style={s.actual > 0 ? { color: 'var(--chart-5)' } : undefined}
                  >
                    {s.actual.toLocaleString('id-ID')}
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
                      onClick={v > 0 ? () => openDetail(s.key, s.label, i) : undefined}
                      className={`px-1 py-2 text-center font-medium ${v > 0 ? 'cursor-pointer hover:underline' : ''}`}
                      style={{ color: v > 0 ? 'var(--chart-5)' : 'var(--muted-foreground)' }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        branchId={branchId}
        date={detail?.date ?? null}
        endDate={detail?.endDate ?? null}
        category={detail?.category ?? null}
        label={detail?.label ?? ''}
        canEdit={canEdit}
        onDataChanged={onDataChanged}
      />
    </div>
  )
}
