import React from 'react'
import { KPISkeleton } from './Skeletons'
import { formatRp, trendIcon, trendColor, pct } from './utils'
import type { KPI } from './types'

interface KpiCardsProps {
  kpi: KPI | null
  kpiLoading: boolean
  year: number
}

export function KpiCards({ kpi, kpiLoading, year }: KpiCardsProps) {
  const kpiCards = [
    {
      label: 'Total Pemasukan',
      value: kpi ? formatRp(kpi.pemasukan) : '—',
      pct: kpi ? pct(kpi.pemasukan, kpi.prevPemasukan) : null,
      color: 'var(--chart-4)',
    },
    {
      label: 'Total Pengeluaran',
      value: kpi ? formatRp(kpi.pengeluaran) : '—',
      pct: kpi ? pct(kpi.pengeluaran, kpi.prevPengeluaran) : null,
      color: 'var(--destructive)',
      invertTrend: true,
    },
    {
      label: 'Laba Bersih',
      value: kpi ? formatRp(kpi.profit) : '—',
      pct: kpi ? pct(kpi.profit, kpi.prevProfit) : null,
      color: 'var(--primary)',
    },
    {
      label: 'Total Kunjungan',
      value: kpi ? kpi.kunjungan.toLocaleString('id-ID') : '—',
      pct: kpi ? pct(kpi.kunjungan, kpi.prevKunjungan) : null,
      color: 'var(--secondary)',
    },
  ]

  if (kpiLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((card) => {
        const p = card.pct
        const effectivePct = card.invertTrend && p !== null ? -p : p
        return (
          <div key={card.label} className="glass-card p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">{card.label}</p>
            <p className="text-lg font-bold text-foreground leading-tight mb-2" style={{ color: card.color }}>{card.value}</p>
            <div className="flex items-center gap-1">
              {trendIcon(effectivePct)}
              <span className={`text-xs font-medium ${trendColor(effectivePct)}`}>
                {p !== null ? `${p > 0 ? '+' : ''}${p.toFixed(1)}% vs ${year - 1}` : `vs ${year - 1}`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
