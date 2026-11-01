import { describe, expect, it } from 'vitest'
import { computePayroll } from './engine'
import { parseCodeInput, summarizeAttendance } from './attendance'
import type { AttendanceCode, Compensation, DeductionRule } from './types'

// Expected values come straight from the Griya Anak workbook
// (reference/2603-10 Gaji Oktober Edit.xlsx — 27 Sep – 26 Okt 2026, Fridays off,
// 26 hari kerja). Sheet "M" (Masuk) is H here.

const WORKDAYS = 26

const RULES: DeductionRule[] = [
  { code: 'LATE', label: 'Terlambat', basis: 'late_minutes', calc_type: 'fixed', amount: 5000, is_active: true, sort_order: 1 },
  { code: 'ALFA', label: 'Tidak absen', basis: 'alfa_days', calc_type: 'fixed', amount: 50000, is_active: true, sort_order: 2 },
]

const BASE: Compensation = {
  gaji_pokok: 1000000, tj_jabatan: 0, operasional: 500000, operasional_mode: 'threshold_full', operasional_threshold: 0.75,
  operasional_daily_rate: 0, insentif_base: 1500000, incentive_target: 60, incentive_full_threshold: 1,
  incentive_activity_codes: ['PAKET_KLINIK', 'SESI_KLINIK', 'TERAPI_AWAL_KLINIK'], bonus_tiers: [],
  activity_rates: { PAKET_VISIT: 750000, SESI_VISIT: 125000, TERAPI_AWAL_VISIT: 175000, JARAK_VISIT: 50000 },
}

const ADMIN: Compensation = {
  ...BASE, insentif_base: 500000, incentive_target: 100, incentive_full_threshold: 0.75,
  incentive_activity_codes: ['KPI_ADMIN'], activity_rates: {},
}

const H = 'H', T = 'T', S = 'S', C = 'C', A = 'A', _ = null

interface Row {
  name: string
  comp: Compensation
  codes: (AttendanceCode | null)[]
  activity: Record<string, number>
  visitBonus: boolean
  expected: { operasional: number; late: number; alfa: number; insentif: number; visit: number; net: number }
}

const klinik = (pt: number, st: number, ta: number) => ({ PAKET_KLINIK: pt, SESI_KLINIK: st, TERAPI_AWAL_KLINIK: ta })

const ROWS: Row[] = [
  {
    name: 'Mia Amalia', comp: ADMIN, visitBonus: false, activity: { KPI_ADMIN: 100 },
    codes: [H, H, H, H, H, _, H, H, H, H, H, H, H, _, H, C, C, C, C, _, H, H, H, H, H, H, H, _, H, T],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 500000, visit: 0, net: 2000000 },
  },
  {
    name: 'Hesty Putri Yuniarti', comp: ADMIN, visitBonus: false, activity: { KPI_ADMIN: 100 },
    codes: [H, H, H, H, H, H, _, T, H, H, H, H, _, H, H, H, H, H, H, H, _, H, H, H, H, H, _, H, H, H],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 500000, visit: 0, net: 2000000 },
  },
  {
    name: 'Lulu Afifah', comp: { ...BASE, gaji_pokok: 1300000 }, visitBonus: true, activity: klinik(71, 18, 7),
    codes: [H, H, H, H, H, _, H, H, H, H, S, S, H, H, _, H, H, H, H, _, H, H, H, H, H, H, H, H, _, H],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 1500000, visit: 0, net: 3300000 },
  },
  {
    // Joined mid-period: 4/26 days → operasional and insentif both prorated.
    name: 'A. M. Stefany Jeviana', comp: BASE, visitBonus: true, activity: klinik(4, 0, 0),
    codes: [H, H, H, H, ...Array(26).fill(_)],
    expected: { operasional: 76923, late: 0, alfa: 0, insentif: 100000, visit: 0, net: 1176923 },
  },
  {
    name: 'Fredelina Alifah', comp: { ...BASE, activity_rates: { ...BASE.activity_rates, PAKET_VISIT: 1000000 } }, visitBonus: true,
    activity: klinik(81, 26, 4),
    codes: [H, H, H, H, H, H, H, _, H, H, H, H, _, H, H, H, 1, H, H, H, H, _, H, H, 4, H, _, H, H, A],
    expected: { operasional: 500000, late: 25000, alfa: 50000, insentif: 1500000, visit: 0, net: 2925000 },
  },
  {
    name: 'Priscilla Forzachita', comp: { ...BASE, gaji_pokok: 3000000, tj_jabatan: 2500000 }, visitBonus: true, activity: klinik(66, 23, 11),
    codes: [H, H, H, H, H, _, H, H, H, H, H, H, H, H, _, H, S, H, H, _, H, H, H, H, H, H, H, H, _, H],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 1500000, visit: 0, net: 7500000 },
  },
  {
    name: 'Istiqomah', comp: { ...BASE, insentif_base: 1700000 }, visitBonus: true, activity: klinik(55, 23, 4),
    codes: [H, H, H, H, H, _, H, H, H, H, H, H, _, S, S, S, H, H, H, _, H, H, H, H, H, H, _, H, H, H],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 1700000, visit: 0, net: 3200000 },
  },
  {
    name: 'Miswilian Libels', comp: { ...BASE, insentif_base: 1300000 }, visitBonus: true,
    activity: { ...klinik(64, 24, 5), PAKET_VISIT: 1, SESI_VISIT: 1, JARAK_VISIT: 1 },
    codes: [H, H, H, H, H, H, H, _, H, H, H, H, _, H, H, H, H, H, H, H, H, _, H, H, H, H, _, H, H, H],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 1300000, visit: 925000, net: 3725000 },
  },
  {
    name: 'Qurratul Ayyuni', comp: BASE, visitBonus: true, activity: { ...klinik(72, 21, 0), PAKET_VISIT: 1 },
    codes: [H, H, H, H, H, _, H, H, H, H, H, H, H, _, H, H, H, H, H, _, H, H, H, H, H, H, H, _, H, H],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 1500000, visit: 750000, net: 3750000 },
  },
  {
    name: 'Xena Ayunda Buciminalda', comp: BASE, visitBonus: true, activity: klinik(63, 28, 0),
    codes: [H, H, H, H, H, H, _, H, H, H, H, H, _, H, H, H, H, H, H, H, _, H, H, H, H, H, _, H, H, H],
    expected: { operasional: 500000, late: 0, alfa: 0, insentif: 1500000, visit: 0, net: 3000000 },
  },
]

function run(row: Row) {
  return computePayroll({
    compensation: row.comp,
    attendance: summarizeAttendance(row.codes, WORKDAYS),
    activity: row.activity,
    deductionRules: RULES,
    adjustments: [],
    roundingUnit: 1,
    visitBonus: row.visitBonus,
  })
}

const line = (r: ReturnType<typeof run>, code: string) => r.lines.find((l) => l.code === code)?.amount ?? 0

describe('Griya Anak sheet (Gaji Oktober 2026)', () => {
  it.each(ROWS)('$name', (row) => {
    const r = run(row)
    expect(line(r, 'OPERASIONAL')).toBe(row.expected.operasional)
    expect(line(r, 'RULE_LATE')).toBe(row.expected.late)
    expect(line(r, 'RULE_ALFA')).toBe(row.expected.alfa)
    expect(line(r, 'INSENTIF')).toBe(row.expected.insentif)
    expect(line(r, 'VISIT')).toBe(row.expected.visit)
    expect(r.net).toBe(row.expected.net)
  })

  it('matches the sheet total (Rp32.576.923, sheet unrounded)', () => {
    expect(ROWS.reduce((s, row) => s + run(row).net, 0)).toBe(32576923)
  })

  it('counts Tugas as present for operasional', () => {
    const a = summarizeAttendance(ROWS[0].codes, WORKDAYS)
    expect(a.hadir).toBe(21)
    expect(a.tugas).toBe(1)
    expect(a.cuti).toBe(4)
  })

  it('pays prorated operasional below the threshold instead of zero', () => {
    const codes: (AttendanceCode | null)[] = [...Array(19).fill(H), ...Array(7).fill(A)]   // 19/26 = 73%
    const r = computePayroll({
      compensation: ADMIN, attendance: summarizeAttendance(codes, WORKDAYS), activity: { KPI_ADMIN: 100 },
      deductionRules: [], adjustments: [], roundingUnit: 1,
    })
    expect(line(r, 'OPERASIONAL')).toBe(365384)   // floor(19/26 × 500.000)
  })

  it('pays full admin insentif from 75% KPI, prorated below', () => {
    const at = (kpi: number) => line(computePayroll({
      compensation: ADMIN, attendance: summarizeAttendance(Array(26).fill(H), WORKDAYS), activity: { KPI_ADMIN: kpi },
      deductionRules: [], adjustments: [], roundingUnit: 1000,
    }), 'INSENTIF')
    expect(at(75)).toBe(500000)
    expect(at(74)).toBe(370000)
  })

  it('accepts the sheet code M as Hadir', () => {
    expect(parseCodeInput('m')).toBe('H')
    expect(parseCodeInput('t')).toBe('T')
  })
})
