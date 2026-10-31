import { describe, expect, it } from 'vitest'
import { countsAsKunjungan } from './achievement'

const visit = (service_type: string | null) =>
  ({ service_type, status: 'completed', kehadiran: 'HADIR' as const, visit_date: '2026-10-27' })

describe('countsAsKunjungan', () => {
  it('counts clinic sessions', () => {
    for (const st of ['TERAPI AWAL KLINIK', 'SESI KLINIK', 'PAKET KLINIK', null]) {
      expect(countsAsKunjungan(visit(st), '2026-10-30')).toBe(true)
    }
  })

  it('never counts sport massage or home visits', () => {
    for (const st of ['SPORT MASSAGE', 'TERAPI AWAL VISIT', 'SESI VISIT', 'PAKET VISIT']) {
      expect(countsAsKunjungan(visit(st), '2026-10-30')).toBe(false)
    }
  })
})
