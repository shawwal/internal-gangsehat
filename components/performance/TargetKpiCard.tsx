'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { pctValue, formatPct, progressColor } from './utils'

interface TargetKpiCardProps {
  label: string
  actual: number
  target: number
  color: string
  delay?: number
}

export function TargetKpiCard({ label, actual, target, color, delay = 0 }: TargetKpiCardProps) {
  const pct = pctValue(actual, target)
  const clamped = pct !== null ? Math.min(pct, 100) : 0
  const barColor = progressColor(pct)

  // Animate progress bar from 0 → actual width on mount
  const [barWidth, setBarWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(clamped), delay + 80)
    return () => clearTimeout(t)
  }, [clamped, delay])

  return (
    <div
      className="glass-card p-5 animate-fade-in-up"
      style={{ '--stagger-delay': `${delay}ms` } as React.CSSProperties}
    >
      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
        {label}
      </p>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-2xl font-bold leading-none" style={{ color }}>
          {actual.toLocaleString('id-ID')}
        </span>
        <span className="text-xs text-muted-foreground">
          / {target.toLocaleString('id-ID')}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden mb-2">
        <div
          className="h-full rounded-full"
          style={{
            width: `${barWidth}%`,
            backgroundColor: barColor,
            transition: 'width 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold" style={{ color: barColor }}>
          {formatPct(actual, target)}
        </span>
        {pct !== null && pct >= 100 && (
          <CheckCircle2 size={12} style={{ color: 'var(--chart-4)' }} />
        )}
      </div>
    </div>
  )
}
