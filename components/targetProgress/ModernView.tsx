'use client'

import { TargetKpiCard } from '@/components/performance/TargetKpiCard'
import { ProgressTrendChart } from './ProgressTrendChart'
import type { CategorySummary } from './types'

interface ModernViewProps {
  summaries: CategorySummary[]
  days: number
}

export function ModernView({ summaries, days }: ModernViewProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaries.map((s, i) => (
          <TargetKpiCard
            key={s.key}
            label={s.label}
            actual={s.actual}
            target={s.target}
            color={s.color}
            delay={i * 80}
          />
        ))}
      </div>
      <ProgressTrendChart summaries={summaries} days={days} />
    </div>
  )
}
