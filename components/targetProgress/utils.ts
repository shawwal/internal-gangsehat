import { TA_TYPES } from '@/components/performance/utils'
import type { CategoryKey, DailyCounts, VisitForProgress } from './types'

export {
  pctValue, formatPct, progressColor,
  getMonthRange, MONTHS, CURRENT_MONTH, CURRENT_YEAR, YEARS,
} from '@/components/performance/utils'

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function classify(serviceType: string | null): CategoryKey | null {
  if (!serviceType) return null
  if ((TA_TYPES as readonly string[]).includes(serviceType)) return 'ta'
  if (serviceType === 'PAKET TERAPI') return 'paket_klinik'
  if (serviceType === 'PAKET VISIT') return 'paket_visit'
  return null
}

export function buildDailyCounts(visits: VisitForProgress[], days: number): DailyCounts {
  const daily: DailyCounts = {
    ta: Array(days).fill(0),
    paket_klinik: Array(days).fill(0),
    kunjungan: Array(days).fill(0),
    paket_visit: Array(days).fill(0),
  }
  for (const v of visits) {
    const day = Number(v.visit_date.slice(8, 10))
    if (!day || day < 1 || day > days) continue
    daily.kunjungan[day - 1] += 1
    const cat = classify(v.service_type)
    if (cat) daily[cat][day - 1] += 1
  }
  return daily
}

export function cumulative(counts: number[]): number[] {
  const out: number[] = []
  let sum = 0
  for (const c of counts) {
    sum += c
    out.push(sum)
  }
  return out
}

export function sum(counts: number[]): number {
  return counts.reduce((a, b) => a + b, 0)
}
