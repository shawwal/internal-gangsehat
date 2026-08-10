import { TA_TYPES, SESI_TYPES, isAttended } from '@/components/performance/utils'
import type { DailyCounts, VisitForProgress, PackageForProgress } from './types'

export {
  pctValue, formatPct, progressColor,
  getMonthRange, MONTHS, CURRENT_MONTH, CURRENT_YEAR, YEARS,
} from '@/components/performance/utils'

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Kunjungan comes from patient_visits attendance alone (kehadiran), unconditionally.
// TA and Sesi also come from patient_visits, but per "Kehadiran ≠ Pembayaran" they
// only count when the visit has a confirmed payment (paidVisitIds) — attendance
// gets you +1 Kunjungan regardless, but TA/Sesi require a validated transaction.
export function buildDailyCounts(
  visits: VisitForProgress[],
  days: number,
  paidVisitIds: Set<string>,
): DailyCounts {
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
    if ((TA_TYPES as readonly string[]).includes(v.service_type ?? '') && paidVisitIds.has(v.id)) {
      daily.ta[day - 1] += 1
    }
    if (isAttended(v)) {
      daily.kunjungan[day - 1] += 1
      // Sessions used from an existing package are labeled "Paket" on jadwal-harian
      // (VisitCard.tsx) — exclude them here so they aren't double-counted as Sesi.
      if (
        (SESI_TYPES as readonly string[]).includes(v.service_type ?? '') &&
        !v.package_id &&
        paidVisitIds.has(v.id)
      ) {
        daily.sesi[day - 1] += 1
      }
    }
  }

  return daily
}

// Paket Klinik / Paket Visit come from patient_packages (the purchase/order
// event itself) — one package purchase = one order, regardless of how many
// sessions it contains or whether they've been attended yet. Per "Kehadiran ≠
// Pembayaran", a purchase only counts once it has a confirmed payment (paidPackageIds).
export function buildPackageDailyCounts(
  packages: PackageForProgress[],
  days: number,
  paidPackageIds: Set<string>,
): DailyCounts {
  const daily: DailyCounts = {
    ta: Array(days).fill(0),
    paket_klinik: Array(days).fill(0),
    kunjungan: Array(days).fill(0),
    paket_visit: Array(days).fill(0),
    sesi: Array(days).fill(0),
  }

  for (const p of packages) {
    if (!paidPackageIds.has(p.id)) continue
    const day = Number(p.purchased_at.slice(8, 10))
    if (!day || day < 1 || day > days) continue
    if (p.category === 'PAKET KLINIK') daily.paket_klinik[day - 1] += 1
    else if (p.category === 'PAKET VISIT') daily.paket_visit[day - 1] += 1
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
