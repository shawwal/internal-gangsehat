// How an activity type is shown in payroll UI: automatic types are named after
// the Layanan kategori they count (SERVICE_TO_CATEGORY), manual ones keep their
// catalogue label under "Lainnya". Display only — codes stay the stored keys.

import { LAYANAN_KATEGORI, SERVICE_TO_CATEGORY } from '@/lib/serviceType'
import type { ServiceType } from '@/types'
import type { ActivityType } from './types'

export interface ActivityDisplay {
  label: string
  group: string
  order: number
}

function groupOf(kategori: string): string {
  if (kategori.includes('SPORT MASSAGE')) return 'Sport Massage'
  if (kategori.includes('VISIT')) return 'Visit'
  if (kategori.includes('KLINIK')) return 'Klinik'
  return 'Lainnya'
}

export function activityDisplay(t: ActivityType): ActivityDisplay {
  const kategori = t.count_mode === 'manual'
    ? []
    : [...new Set(t.source_service_types.map((s) => SERVICE_TO_CATEGORY[s as ServiceType] ?? s))]
  if (kategori.length === 0) return { label: t.label, group: 'Lainnya', order: LAYANAN_KATEGORI.length }
  const idx = LAYANAN_KATEGORI.indexOf(kategori[0])
  return { label: kategori.join(' + '), group: groupOf(kategori[0]), order: idx < 0 ? LAYANAN_KATEGORI.length - 1 : idx }
}

/** Types in kategori order (manual last), ties by catalogue sort_order. */
export function sortActivityTypes(types: ActivityType[]): ActivityType[] {
  return [...types].sort((a, b) => activityDisplay(a).order - activityDisplay(b).order || a.sort_order - b.sort_order)
}
