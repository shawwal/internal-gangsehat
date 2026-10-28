import { describe, expect, it } from 'vitest'
import { computePfotmAutoMetrics, pfotmHits, pfotmHitsWithGap } from './autoMetrics'
import { rankBoard, type PointRule } from './engine'
import { countedSaleIds } from '@/lib/metrics/achievement'
import type { VisitForPayroll } from '@/lib/payroll/autoActivity'

const visit = (over: Partial<VisitForPayroll>): VisitForPayroll => ({
  id: Math.random().toString(36), attending_staff_id: 'a', service_type: 'SESI KLINIK', layanan_id: null,
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
      visit({ service_type: 'TERAPI AWAL VISIT' }),                          // counts toward no target
      visit({ status: 'cancelled' }),
    ])
    expect(out.a.kunjungan).toBe(3)
  })

  it('takes package / visit sales from LUNAS/DP transactions', () => {
    const out = run([], [
      { staff_id: 'a', category: 'PAKET KLINIK', package: { id: 'p1', jenis_paket: 'P1', total_sessions: 5 } },
      { staff_id: 'a', category: 'PAKET KLINIK', package: { id: 'p2', jenis_paket: null, total_sessions: 10 } },
      { staff_id: 'b', category: 'TERAPI AWAL VISIT', package: null },
      { staff_id: 'b', category: 'SESI VISIT', package: null },
      { staff_id: 'b', category: 'PAKET VISIT', package: null },
      { staff_id: null, category: 'PAKET VISIT', package: null },
    ])
    expect(out.a).toMatchObject({ paket_1: 1, paket_2: 1 })
    expect(out.b).toMatchObject({ terapi_awal_sesi_visit: 2, paket_visit: 1 })
  })

  it('maps sales by their Layanan tag when the branch has one (null = no column)', () => {
    const out = run([], [
      { staff_id: 'a', category: 'PAKET KLINIK', package: { id: 'p', jenis_paket: 'P2', total_sessions: 10 }, metric: 'paket_3' },
      { staff_id: 'a', category: 'PAKET VISIT', package: null, metric: 'paket_visit' },
      { staff_id: 'a', category: 'PAKET KLINIK', package: null, metric: null },
    ])
    expect(out.a).toMatchObject({ paket_1: 0, paket_2: 0, paket_3: 1, paket_visit: 1 })
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
        { id: 't1', staff_id: 'a', category: 'TERAPI AWAL VISIT', transaction_date: '2026-10-03', package: null },
        { id: 't2', staff_id: null, category: 'PAKET VISIT', transaction_date: '2026-10-05', package: null },
        { id: 't3', staff_id: null, category: 'TERAPI AWAL KLINIK', transaction_date: '2026-10-05', package: null }, // not a PFOTM column
      ],
    }
    const { hits, gap } = pfotmHitsWithGap(params)
    expect(hits).toEqual(pfotmHits(params))
    expect(computePfotmAutoMetrics(params).a).toMatchObject({ kunjungan: 1, terapi_awal_sesi_visit: 1, paket_visit: 0 })
    expect(gap.map((g) => [g.key, g.staff_id])).toEqual([['kunjungan', 'mgr'], ['kunjungan', null], ['paket_visit', null]])
  })
})

describe('sales rule', () => {
  const row = (id: string, transaction_date: string, payment_status: string, amount: number, order_id = 'o1') =>
    ({ id, patient_id: 'p', category: 'PAKET KLINIK', payment_status, transaction_date, harga: 750000, discount: 0, amount, order_id })
  const rows = [
    row('dp1', '2026-10-01', 'DP', 300000),
    row('dp2', '2026-10-05', 'DP', 100000),               // second DP = installment, not a sale
    row('cic', '2026-10-06', 'CICILAN', 100000),
    row('close', '2026-10-07', 'LUNAS', 150000),           // remainder mislabelled LUNAS
    row('new', '2026-10-08', 'LUNAS', 750000, 'o2'),       // a new package paid in full
    row('dp3', '2026-10-09', 'DP', 300000, 'o3'),
    row('full', '2026-10-10', 'LUNAS', 450000, 'o3'),      // same order → closes dp3
  ]

  it('counts only the first payment of each purchase by default', () => {
    expect([...countedSaleIds(rows)]).toEqual(['dp1', 'new', 'dp3'])
  })

  it('also counts a full-price LUNAS on another order with fullLunasIsNewSale', () => {
    const newPackage = [row('dp1', '2026-10-01', 'DP', 300000), row('new', '2026-10-02', 'LUNAS', 750000, 'o2')]
    expect([...countedSaleIds(newPackage)]).toEqual(['dp1'])
    expect([...countedSaleIds(newPackage, { fullLunasIsNewSale: true })]).toEqual(['dp1', 'new'])
    const remainder = [row('dp1', '2026-10-01', 'DP', 300000), row('close', '2026-10-02', 'LUNAS', 450000)]
    expect([...countedSaleIds(remainder, { fullLunasIsNewSale: true })]).toEqual(['dp1'])
  })
})
