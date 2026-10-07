import { describe, expect, it } from 'vitest'
import { computePfotmAutoMetrics } from './autoMetrics'
import { rankBoard, type PointRule } from './engine'
import type { VisitForPayroll } from '@/lib/payroll/autoActivity'

const visit = (over: Partial<VisitForPayroll>): VisitForPayroll => ({
  id: Math.random().toString(36), attending_staff_id: 'a', service_type: 'SESI TERAPI', layanan_id: null,
  visit_date: '2026-10-01', kehadiran: 'HADIR', package_id: null,
  status: 'completed', diagnosis: 'PFPS', treatment: 'TENS', regio: null, ...over,
})

const run = (periodVisits: VisitForPayroll[], sales: Parameters<typeof computePfotmAutoMetrics>[0]['sales'] = []) =>
  computePfotmAutoMetrics({
    staffIds: ['a', 'b'], start: '2026-09-27', end: '2026-10-26', todayISO: '2026-10-07',
    attendance: [], periodVisits, sales, referrals: [],
  })

describe('PFOTM auto metrics', () => {
  it('counts only visits with a complete medical record', () => {
    const out = run([
      visit({}),
      visit({ treatment: null }),                                   // missing tindakan
      visit({ service_type: 'TERAPI AWAL' }),                       // TA needs regio
      visit({ service_type: 'TERAPI AWAL', regio: 'KNEE' }),
      visit({ status: 'scheduled' }),                               // not completed
    ])
    expect(out.a.kunjungan).toBe(2)
  })

  it('takes package / visit sales from LUNAS/DP transactions', () => {
    const out = run([], [
      { staff_id: 'a', category: 'PAKET KLINIK', package: { id: 'p1', jenis_paket: 'P1', total_sessions: 5 } },
      { staff_id: 'a', category: 'PAKET KLINIK', package: { id: 'p2', jenis_paket: null, total_sessions: 10 } },
      { staff_id: 'b', category: 'TA VISIT', package: null },
      { staff_id: 'b', category: 'SESI VISIT', package: null },
      { staff_id: 'b', category: 'PAKET VISIT', package: null },
      { staff_id: null, category: 'PAKET VISIT', package: null },
    ])
    expect(out.a).toMatchObject({ paket_1: 1, paket_2: 1 })
    expect(out.b).toMatchObject({ ta_sesi_visit: 2, paket_visit: 1 })
  })
})

describe('PFOTM ranking', () => {
  it('breaks a points tie by Jumlah Kunjungan', () => {
    const rules: PointRule[] = [
      { metric_key: 'kunjungan', metric_label: 'Kunjungan', weight: 1, is_penalty: false },
      { metric_key: 'paket_2', metric_label: 'Paket 2', weight: 6, is_penalty: false },
    ]
    const board = rankBoard([
      { key: 'hena', name: 'HENA', metrics: { kunjungan: 24, paket_2: 1 } },
      { key: 'prity', name: 'PRITY', metrics: { kunjungan: 30 } },
    ], rules, 26)
    expect(board.map((r) => [r.name, r.total, r.rank])).toEqual([['PRITY', 30, 1], ['HENA', 30, 2]])
  })
})
