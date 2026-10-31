import { describe, expect, it } from 'vitest'
import { closingHits, closingRate } from './closingRate'

const sale = (id: string, patient_id: string, category: string, transaction_date: string) =>
  ({ id, patient_id, category, transaction_date })

describe('closingHits', () => {
  it('counts SESI / PAKET KLINIK within 4 calendar days, any seller, past the period', () => {
    const ta = [
      sale('t1', 'p1', 'TERAPI AWAL KLINIK', '2026-10-24'),
      sale('t2', 'p2', 'TERAPI AWAL KLINIK', '2026-10-24'),
      sale('t3', 'p3', 'TERAPI AWAL KLINIK', '2026-10-24'),
      sale('t4', 'p4', 'TERAPI AWAL KLINIK', '2026-10-24'),
    ]
    const follow = [
      sale('f1', 'p1', 'PAKET KLINIK', '2026-10-28'), // day 4 → closed
      sale('f2', 'p2', 'SESI KLINIK', '2026-10-29'),  // day 5 → too late
      sale('f3', 'p3', 'TERAPI AWAL VISIT', '2026-10-25'), // wrong category
      sale('f4', 'p4', 'SESI KLINIK', '2026-10-24'),  // same day → closed
    ]
    const hits = closingHits(ta, follow)
    expect(hits.map((h) => h.closedBy?.id ?? null)).toEqual(['f1', null, null, 'f4'])
    expect(closingRate(hits)).toBe(0.5)
  })

  it('is 0 with no TA', () => {
    expect(closingRate(closingHits([], []))).toBe(0)
  })
})
