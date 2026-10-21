import { countsAsKunjungan } from '@/lib/metrics/achievement'
import { TRANSACTION_CATEGORY_MAP } from './types'
import type { DailyCounts, VisitForProgress, TransactionForProgress } from './types'

export {
  pctValue, formatPct, progressColor,
  getMonthRange, MONTHS, CURRENT_MONTH, CURRENT_YEAR, YEARS,
} from '@/components/performance/utils'

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function emptyDaily(n: number): DailyCounts {
  return {
    ta: Array(n).fill(0),
    paket_klinik: Array(n).fill(0),
    kunjungan: Array(n).fill(0),
    paket_visit: Array(n).fill(0),
    sesi: Array(n).fill(0),
  }
}

const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

// Kunjungan: lib/metrics/achievement countsAsKunjungan — the same rule PFOTM and
// payroll use per therapist. `dates` is the window's day list (calendar month
// or payroll period); index i of every array is dates[i].
export function buildDailyCounts(visits: VisitForProgress[], dates: string[]): DailyCounts {
  const daily = emptyDaily(dates.length)
  const index = new Map(dates.map((d, i) => [d, i]))
  const today = todayISO()
  for (const v of visits) {
    const i = index.get(v.visit_date)
    if (i === undefined) continue
    if (countsAsKunjungan(v, today)) daily.kunjungan[i] += 1
  }
  return daily
}

// TA/Sesi/Paket Klinik/Paket Visit all come straight from `transactions`: one
// valid sale (lib/metrics/achievement saleIssues — the first LUNAS/DP payment
// of a purchase) = one countable event; the caller already filtered for that.
export function buildTransactionDailyCounts(transactions: TransactionForProgress[], dates: string[]): DailyCounts {
  const daily = emptyDaily(dates.length)
  const index = new Map(dates.map((d, i) => [d, i]))
  for (const t of transactions) {
    const key = TRANSACTION_CATEGORY_MAP[t.category]
    if (!key) continue
    const i = index.get(t.transaction_date)
    if (i === undefined) continue
    daily[key][i] += 1
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
