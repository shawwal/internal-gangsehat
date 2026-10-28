import { describe, expect, it } from 'vitest'
import { activityDisplay, sortActivityTypes } from './activityDisplay'
import type { ActivityType } from './types'

const type = (code: string, count_mode: ActivityType['count_mode'], source: string[], sort_order: number, label = code): ActivityType => ({
  code, label, group_label: 'x', count_mode, source_service_types: source, source_layanan_ids: [], max_per_period: 100, sort_order, is_active: true,
})

describe('activityDisplay', () => {
  it('names automatic types after their layanan kategori', () => {
    expect(activityDisplay(type('PAKET_KLINIK', 'session', ['PAKET KLINIK'], 10))).toEqual({ label: 'PAKET KLINIK', group: 'Klinik', order: 2 })
    expect(activityDisplay(type('PAKET_VISIT', 'package', ['PAKET VISIT'], 30))).toMatchObject({ label: 'PAKET VISIT', group: 'Visit' })
  })

  it('keeps manual types under Lainnya', () => {
    expect(activityDisplay(type('KONTEN', 'manual', [], 51, 'Jumlah Konten'))).toMatchObject({ label: 'Jumlah Konten', group: 'Lainnya' })
  })

  it('sorts by kategori order, manual last', () => {
    const sorted = sortActivityTypes([
      type('KONTEN', 'manual', [], 1),
      type('PAKET_KLINIK', 'session', ['PAKET KLINIK'], 10),
      type('TERAPI_AWAL_VISIT', 'session', ['TERAPI AWAL VISIT'], 32),
      type('TERAPI_AWAL_KLINIK', 'session', ['TERAPI AWAL KLINIK'], 12),
    ])
    expect(sorted.map((t) => t.code)).toEqual(['TERAPI_AWAL_KLINIK', 'PAKET_KLINIK', 'TERAPI_AWAL_VISIT', 'KONTEN'])
  })
})
