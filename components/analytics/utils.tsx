import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export function formatRpCompact(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function trendIcon(pct: number | null) {
  if (pct === null) return <Minus size={14} className="text-muted-foreground" />
  if (pct > 0) return <TrendingUp size={14} className="text-chart-4" />
  if (pct < 0) return <TrendingDown size={14} className="text-destructive" />
  return <Minus size={14} className="text-muted-foreground" />
}

export function trendColor(pct: number | null) {
  if (pct === null) return 'text-muted-foreground'
  if (pct > 0) return 'text-chart-4'
  if (pct < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

export function pct(cur: number, prev: number | null) {
  if (prev === null || prev === 0) return null
  return ((cur - prev) / prev) * 100
}
