import { describe, expect, it } from 'vitest'
import { countsAsKunjungan, groupPurchases, kunjunganIssues, saleIssues, type SaleTx } from './achievement'
import { packageTierKey, pfotmHits } from '@/lib/pfotm/autoMetrics'
import { effectiveServiceType, payrollActivityHits, type VisitForPayroll } from '@/lib/payroll/autoActivity'
import type { ActivityType } from '@/lib/payroll/types'

const tx = (over: Partial<SaleTx>): SaleTx => ({
  id: Math.random().toString(36), order_id: null, category: 'PAKET KLINIK', payment_status: 'LUNAS',
  patient_id: 'p', staff_id: 's', receipt_url: 'proof.jpg', harga: 750000, discount: 0, amount: 750000,
  transaction_date: '2026-09-29', ...over,
})
const issuesOf = (rows: SaleTx[]) => {
  const purchases = groupPurchases(rows)
  return rows.map((r) => saleIssues(r, purchases.get(r.id)))
}

describe('valid sale (Request 2)', () => {
  it('rejects the WENDY ALEXANDRA duplicate without a Fisio', () => {
    expect(issuesOf([tx({}), tx({ staff_id: null })])).toEqual([[], ['Tanpa Fisio']])
  })

  it('needs proof of payment on packages, cash included — not on TA / Sesi', () => {
    expect(issuesOf([tx({ receipt_url: null })])[0]).toContain('Tanpa bukti bayar')
    expect(issuesOf([tx({ category: 'TA KLINIK', receipt_url: null, staff_id: null })])[0]).toEqual([])
  })

  it('checks package amounts per status', () => {
    expect(issuesOf([tx({ amount: 800000 })])[0]).toContain('Dibayar melebihi harga')
    expect(issuesOf([tx({ amount: 700000 })])[0]).toContain('LUNAS tapi dibayar kurang dari harga')
    expect(issuesOf([tx({ payment_status: 'DP', amount: 300000 })])[0]).toEqual([])
    expect(issuesOf([tx({ payment_status: 'DP', amount: 750000 })])[0]).toContain('DP sebesar harga penuh')
  })

  it('counts a DP + pelunasan once, on the DP, and flags an overpaid order', () => {
    const dp = tx({ id: 'a', order_id: 'o', payment_status: 'DP', amount: 300000 })
    const lunas = tx({ id: 'b', order_id: 'o', payment_status: 'LUNAS', amount: 450000, transaction_date: '2026-10-05' })
    expect(issuesOf([dp, lunas])).toEqual([[], ['Pembayaran lanjutan — dihitung di pembayaran pertama']])
    const over = tx({ id: 'c', order_id: 'o', payment_status: null, amount: 100000, transaction_date: '2026-10-06' })
    expect(issuesOf([dp, lunas, over])[0]).toContain('Total pembayaran melebihi harga')
  })
})

describe('valid kunjungan (Request 4)', () => {
  const v = { visit_date: '2026-10-01', kehadiran: 'HADIR' as const, status: 'completed', service_type: 'SESI TERAPI' }
  it('needs a completed record', () => {
    expect(countsAsKunjungan({ ...v, record_complete: true }, '2026-10-21')).toBe(true)
    expect(kunjunganIssues({ ...v, record_complete: false }, '2026-10-21')).toEqual(['Belum Ditangani'])
    expect(kunjunganIssues({ ...v, service_type: 'TERAPI AWAL', record_complete: false }, '2026-10-21')).toEqual(['Belum Diperiksa'])
  })
})

describe('PFOTM paket tier (Request 9)', () => {
  it('maps 5 / 10 / 20 sessions and leaves other sizes out', () => {
    const pkg = (n: number) => ({ id: 'x', jenis_paket: 'P1', total_sessions: n })
    expect([5, 10, 20, 3, 4].map((n) => packageTierKey(pkg(n)))).toEqual(['paket_1', 'paket_2', 'paket_3', null, null])
  })
})

describe('PFOTM closing rate (Request 8)', () => {
  it('closes when the TA patient buys SESI / PAKET KLINIK within 4 days, any therapist', () => {
    const hits = pfotmHits({
      staffIds: ['prity'], start: '2026-09-27', end: '2026-10-26', todayISO: '2026-10-21',
      attendance: [], periodVisits: [], sales: [], referrals: [],
      taSales: [
        { id: 't1', staff_id: 'prity', patient_id: 'a', transaction_date: '2026-10-01' },
        { id: 't2', staff_id: 'prity', patient_id: 'b', transaction_date: '2026-10-01' },
      ],
      returnSales: [{ patient_id: 'a', transaction_date: '2026-10-05' }, { patient_id: 'b', transaction_date: '2026-10-06' }],
    })
    expect(hits.filter((h) => h.key === 'ta_klinik')).toHaveLength(2)
    expect(hits.filter((h) => h.key === 'ta_closing').map((h) => h.patient_id)).toEqual(['a'])
  })
})

describe('payroll activity (Requests 5, 6)', () => {
  const type = (code: string, mode: ActivityType['count_mode'], services: string[]): ActivityType => ({
    code, label: code, group_label: '', count_mode: mode, source_service_types: services, source_layanan_ids: [],
    max_per_period: 999, sort_order: 0, is_active: true,
  })
  const visit = (over: Partial<VisitForPayroll>): VisitForPayroll => ({
    id: Math.random().toString(36), attending_staff_id: 'hesti', service_type: 'SESI TERAPI', layanan_id: null,
    visit_date: '2026-10-01', kehadiran: 'HADIR', package_id: null, record_complete: true, ...over,
  })
  const base = { firstPackageVisit: new Map(), staffIds: ['hesti'], start: '2026-09-27', end: '2026-10-26', todayISO: '2026-10-21' }

  it('counts a package session booked as SESI TERAPI as PT, per session', () => {
    expect(effectiveServiceType({ service_type: 'SESI TERAPI', package_id: 'pkg' })).toBe('PAKET TERAPI')
    const hits = payrollActivityHits({
      ...base, sales: [],
      types: [type('KLINIK_PT', 'session', ['PAKET TERAPI']), type('KLINIK_ST', 'session', ['SESI TERAPI'])],
      periodVisits: [visit({ package_id: 'pkg' }), visit({ package_id: 'pkg' }), visit({}), visit({ package_id: 'pkg', record_complete: false })],
    })
    expect(hits.map((h) => h.code)).toEqual(['KLINIK_PT', 'KLINIK_PT', 'KLINIK_ST'])
  })

  it('counts home visits from completed payments, credited to the transaction Fisio', () => {
    const lunas = tx({ id: 'v1', category: 'TA VISIT', staff_id: 'hesti', transaction_date: '2026-10-08' })
    const dp = tx({ id: 'v2', order_id: 'o', category: 'PAKET VISIT', staff_id: 'hesti', payment_status: 'DP', harga: 1800000, amount: 800000 })
    const purchases = groupPurchases([lunas, dp])
    const hits = payrollActivityHits({
      ...base, periodVisits: [],
      types: [type('VISIT_TA', 'session', ['TA VISIT']), type('VISIT_PT', 'package', ['PAKET VISIT'])],
      sales: [{ tx: lunas, purchase: purchases.get('v1')! }, { tx: dp, purchase: purchases.get('v2')! }],
    })
    // The DP is still owed → no PT Visit yet.
    expect(hits.map((h) => [h.code, h.date])).toEqual([['VISIT_TA', '2026-10-08']])
  })
})
