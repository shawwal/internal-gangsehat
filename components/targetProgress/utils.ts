import { isAttended } from '@/components/performance/utils'
import { TRANSACTION_CATEGORY_MAP } from './types'
import type { DailyCounts, VisitForProgress, TransactionForProgress } from './types'

export {
  pctValue, formatPct, progressColor,
  getMonthRange, MONTHS, CURRENT_MONTH, CURRENT_YEAR, YEARS,
} from '@/components/performance/utils'

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Kunjungan comes from patient_visits attendance alone (kehadiran), unconditionally —
// no payment gating at all.
export function buildDailyCounts(visits: VisitForProgress[], days: number): DailyCounts {
  const daily: DailyCounts = {
    ta: Array(days).fill(0),
    paket_klinik: Array(days).fill(0),
    kunjungan: Array(days).fill(0),
    paket_visit: Array(days).fill(0),
    sesi: Array(days).fill(0),
  }

  for (const v of visits) {
    const day = Number(v.visit_date.slice(8, 10))
    if (!day || day < 1 || day > days) continue
    if (isAttended(v)) daily.kunjungan[day - 1] += 1
  }

  return daily
}

// TA/Sesi/Paket Klinik/Paket Visit all come straight from `transactions`: one
// income row with payment_status LUNAS or DP = one countable event (the caller
// already filtered for that). Excluding PELUNASAN rows is what keeps a single
// package/session from being counted twice when it's settled in installments.
export function buildTransactionDailyCounts(transactions: TransactionForProgress[], days: number): DailyCounts {
  const daily: DailyCounts = {
    ta: Array(days).fill(0),
    paket_klinik: Array(days).fill(0),
    kunjungan: Array(days).fill(0),
    paket_visit: Array(days).fill(0),
    sesi: Array(days).fill(0),
  }

  for (const t of transactions) {
    const key = TRANSACTION_CATEGORY_MAP[t.category]
    if (!key) continue
    const day = Number(t.transaction_date.slice(8, 10))
    if (!day || day < 1 || day > days) continue
    daily[key][day - 1] += 1
  }

  return daily
}

export function mergeDailyCounts(a: DailyCounts, b: DailyCounts): DailyCounts {
  const merged: DailyCounts = {
    ta: [...a.ta],
    paket_klinik: [...a.paket_klinik],
    kunjungan: [...a.kunjungan],
    paket_visit: [...a.paket_visit],
    sesi: [...a.sesi],
  }
  for (const key of ['ta', 'paket_klinik', 'kunjungan', 'paket_visit', 'sesi'] as const) {
    for (let i = 0; i < merged[key].length; i++) merged[key][i] += b[key][i] ?? 0
  }
  return merged
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
