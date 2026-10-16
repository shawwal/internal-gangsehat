import { describe, expect, it } from 'vitest'
import { computePfotmAutoMetrics, pfotmHits, pfotmHitsWithGap } from './autoMetrics'
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
  it('counts kunjungan with the Target Progress rule (attended, not sport massage)', () => {
    const out = run([
      visit({}),
      visit({ treatment: null }),                                   // record completeness no longer gates
      visit({ status: 'scheduled' }),                               // attended scheduled visit counts
      visit({ kehadiran: 'TIDAK HADIR' }),                          // absent
      visit({ kehadiran: null, visit_date: '2026-10-20' }),         // unmarked, still in the future
      visit({ service_type: 'SPORT MASSAGE' }),                     // tracked separately
      visit({ status: 'cancelled' }),
    ])
    expect(out.a.kunjungan).toBe(3)
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

describe('PFOTM hits', () => {
  it('lists exactly the units behind each count', () => {
    const params = {
      staffIds: ['a'], start: '2026-09-27', end: '2026-10-26', todayISO: '2026-10-07',
      attendance: [], referrals: [],
      periodVisits: [visit({ patient_id: 'p1' }), visit({ patient_id: 'p2', visit_date: '2026-10-02' })],
      sales: [{ id: 't1', staff_id: 'a', category: 'PAKET VISIT', transaction_date: '2026-10-03', patient_id: 'p3', package: null }],
    }
    const hits = pfotmHits(params)
    expect(hits.filter((h) => h.key === 'kunjungan').map((h) => h.patient_id)).toEqual(['p1', 'p2'])
    expect(hits.find((h) => h.key === 'paket_visit')).toMatchObject({ date: '2026-10-03', patient_id: 'p3', ref_id: 't1' })
    expect(computePfotmAutoMetrics(params).a).toMatchObject({ kunjungan: 2, paket_visit: 1 })
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

describe('PFOTM gap', () => {
  it('keeps sales / visits credited to no participant out of the board but in the gap', () => {
    const params = {
      staffIds: ['a'], start: '2026-09-27', end: '2026-10-26', todayISO: '2026-10-07',
      attendance: [], referrals: [],
      periodVisits: [visit({}), visit({ attending_staff_id: 'mgr' }), visit({ attending_staff_id: null })],
      sales: [
        { id: 't1', staff_id: 'a', category: 'TA VISIT', transaction_date: '2026-10-03', package: null },
        { id: 't2', staff_id: null, category: 'PAKET VISIT', transaction_date: '2026-10-05', package: null },
        { id: 't3', staff_id: null, category: 'TA KLINIK', transaction_date: '2026-10-05', package: null }, // not a PFOTM column
      ],
    }
    const { hits, gap } = pfotmHitsWithGap(params)
    expect(hits).toEqual(pfotmHits(params))
    expect(computePfotmAutoMetrics(params).a).toMatchObject({ kunjungan: 1, ta_sesi_visit: 1, paket_visit: 0 })
    expect(gap.map((g) => [g.key, g.staff_id])).toEqual([['kunjungan', 'mgr'], ['kunjungan', null], ['paket_visit', null]])
  })
})
