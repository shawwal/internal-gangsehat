import { describe, expect, it } from 'vitest'
import rawFixture from './__fixtures__/penggajian-sep-2026.json'
import { computePayroll, computeOperasional, floorTo, pickCompensation, visibleSlipLines } from './engine'
import { summarizeAttendance, parseCodeInput, codeFromRow, rowFromCode } from './attendance'
import { buildPeriodDays, periodRange, shortDayLabel } from './period'
import type { Adjustment, AttendanceCode, Compensation, DeductionRule } from './types'

// Expected values below come straight from the legacy workbook
// (reference/1.1 - Request Sistem Penggajian (Example).xlsx, PERIODE SEPTEMBER 2026).

interface FixtureEmployee {
  employee_no: string
  full_name: string
  alias: string
  jabatan: string
  compensation: Compensation
  activity: Record<string, number>
  attendance: (AttendanceCode | null)[]
  adjustments: Adjustment[]
  expected: Record<'hadir' | 'tlbt' | 'izin' | 'sakit' | 'cuti' | 'alfa' | 'operasional' | 'late_fine' | 'alfa_fine' | 'insentif' | 'visit' | 'klinik' | 'total_gaji', number>
}
const fixture = rawFixture as unknown as {
  period: { year: number; month: number; start: string; end: string; workdays: number }
  days: { date: string; workday: boolean }[]
  employees: FixtureEmployee[]
  expected_total: number
  deduction_rules: DeductionRule[]
}

const workdays = fixture.period.workdays
const rules = fixture.deduction_rules

function run(emp: FixtureEmployee) {
  const codes = emp.attendance
  const attendance = summarizeAttendance(codes, workdays)
  return {
    attendance,
    result: computePayroll({
      compensation: emp.compensation,
      attendance,
      activity: emp.activity,
      deductionRules: rules,
      adjustments: emp.adjustments,
      roundingUnit: 1000,
    }),
  }
}

describe('period builder (TEMP sheet)', () => {
  it('builds 27 Aug – 26 Sep 2026 with 23 workdays (Fridays off + 1–3 Sep)', () => {
    const p = buildPeriodDays(2026, 9, {
      startDay: 27,
      weeklyOffDays: ['JUMAT'],
      holidays: [
        { date: '2026-09-01', name: 'Libur' },
        { date: '2026-09-02', name: 'Libur' },
        { date: '2026-09-03', name: 'Libur' },
      ],
    })
    expect(p.start).toBe(fixture.period.start)
    expect(p.end).toBe(fixture.period.end)
    expect(p.days).toHaveLength(31)
    expect(p.workdays).toBe(workdays)
    expect(p.days.map((d) => d.workday)).toEqual(fixture.days.map((d) => d.workday))
  })

  it('uses the localized day headers', () => {
    expect(shortDayLabel('2026-08-27')).toBe('KAM')
    expect(shortDayLabel('2026-08-28')).toBe('JUM')
    expect(shortDayLabel('2026-08-30')).toBe('MIN')
  })

  it('handles year boundaries, leap years and short months without gaps', () => {
    expect(periodRange(2027, 1, 27)).toEqual({ start: '2026-12-27', end: '2027-01-26' })
    expect(periodRange(2028, 3, 27)).toEqual({ start: '2028-02-27', end: '2028-03-26' })
    // start day 30 clamps to the end of February
    expect(periodRange(2027, 3, 30)).toEqual({ start: '2027-02-28', end: '2027-03-29' })
    expect(periodRange(2027, 2, 30)).toEqual({ start: '2027-01-30', end: '2027-02-27' })
    expect(periodRange(2028, 3, 30)).toEqual({ start: '2028-02-29', end: '2028-03-29' })
    // start day 1 = calendar month
    expect(periodRange(2028, 2, 1)).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    // consecutive periods tile the calendar
    for (let month = 1; month <= 12; month++) {
      const cur = periodRange(2028, month, 31)
      const next = month === 12 ? periodRange(2029, 1, 31) : periodRange(2028, month + 1, 31)
      const dayAfter = new Date(`${cur.end}T00:00:00Z`)
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)
      expect(next.start).toBe(dayAfter.toISOString().slice(0, 10))
    }
  })
})

describe('attendance codes (ABS sheet)', () => {
  it('parses grid input', () => {
    expect(parseCodeInput('h')).toBe('H')
    expect(parseCodeInput(' 7 ')).toBe(7)
    expect(parseCodeInput('0')).toBe('H')
    expect(parseCodeInput('')).toBeNull()
    expect(parseCodeInput('X')).toBeUndefined()
    expect(parseCodeInput('-3')).toBeUndefined()
    expect(parseCodeInput('900')).toBeUndefined()
  })

  it('round-trips through attendance rows', () => {
    for (const code of ['H', 'I', 'S', 'C', 'A', 12] as AttendanceCode[]) {
      const row = rowFromCode(code)
      expect(codeFromRow(row)).toBe(code)
    }
  })

  it.each(fixture.employees.map((e) => [e.alias, e] as const))('summarises %s like ABS!AL:AQ', (_alias, emp) => {
    const a = summarizeAttendance(emp.attendance, workdays)
    expect(a.hadir).toBe(emp.expected.hadir)
    expect(a.lateMinutes).toBe(emp.expected.tlbt)
    expect(a.izin).toBe(emp.expected.izin)
    expect(a.sakit).toBe(emp.expected.sakit)
    expect(a.cuti).toBe(emp.expected.cuti)
    expect(a.alfa).toBe(emp.expected.alfa)
  })
})

describe('payroll engine (ABS / INS / GAJI sheets)', () => {
  it.each(fixture.employees.map((e) => [e.alias, e] as const))('reproduces the GAJI row for %s', (_alias, emp) => {
    const { result } = run(emp)
    const line = (code: string) => result.lines.find((l) => l.code === code)?.amount ?? 0

    // ABS!AR is negative for the masseur rule when days are missed; 0 here.
    expect(Math.max(0, emp.expected.operasional)).toBe(line('OPERASIONAL'))
    expect(line('RULE_LATE')).toBe(emp.expected.late_fine)
    expect(line('RULE_ALFA')).toBe(emp.expected.alfa_fine)
    expect(line('INSENTIF')).toBe(emp.expected.insentif)
    expect(result.visit).toBe(emp.expected.visit)
    expect(result.klinik).toBe(emp.expected.klinik)
    expect(result.net).toBe(emp.expected.total_gaji)
  })

  it('matches the GAJI grand total of Rp 42.040.000', () => {
    const total = fixture.employees.reduce((s, e) => s + run(e).result.net, 0)
    expect(total).toBe(fixture.expected_total)
  })

  it('puts the DENDA keterangan on the slip notes', () => {
    const ory = fixture.employees.find((e) => e.alias === 'ORY')!
    expect(run(ory).result.notes).toBe('DENDA TIDAK MENGIKUTI FAMILY GATHERING')
  })

  it('omits zero-value lines from the payslip', () => {
    const nada = fixture.employees.find((e) => e.alias === 'NADA')!
    const visible = visibleSlipLines(run(nada).result.lines).map((l) => l.code)
    expect(visible).toEqual(['GAJI_POKOK'])
  })

  it('zeroes operasional at or below the attendance threshold', () => {
    const comp = fixture.employees[2].compensation
    const low = summarizeAttendance(Array<AttendanceCode>(17).fill('H'), 23) // 17/23 = 73.9% ≤ 75%
    expect(computeOperasional(comp, low, 1000).amount).toBe(0)
    const ok = summarizeAttendance(Array<AttendanceCode>(18).fill('H'), 23) // 78.3%
    expect(computeOperasional(comp, ok, 1000).amount).toBe(floorTo((18 / 23) * 500000, 1000))
  })

  it('turns a negative masseur operasional into a "Potongan Kehadiran" deduction', () => {
    const alam = fixture.employees.find((e) => e.alias === 'ALAM')!
    const codes = [...(alam.attendance)]
    const firstH = codes.indexOf('H')
    codes[firstH] = 'A'
    const attendance = summarizeAttendance(codes, workdays)
    const r = computePayroll({
      compensation: alam.compensation, attendance,
      activity: alam.activity, deductionRules: rules, adjustments: [], roundingUnit: 1000,
    })
    expect(r.lines.find((l) => l.code === 'POTONGAN_KEHADIRAN')?.amount).toBe(100000)
    expect(r.lines.find((l) => l.code === 'RULE_ALFA')?.amount).toBe(100000)
  })

  it('supports percentage-based deduction rules', () => {
    const emp = fixture.employees[2]
    const { attendance } = run(emp)
    const r = computePayroll({
      compensation: emp.compensation,
      attendance,
      activity: emp.activity,
      deductionRules: [{ code: 'LATE_PCT', label: 'Terlambat', basis: 'late_days', calc_type: 'percent_base', amount: 1, is_active: true, sort_order: 1 }],
      adjustments: [],
      roundingUnit: 1000,
    })
    // HESTI: 2 late days × 1% × 1.500.000
    expect(r.lines.find((l) => l.code === 'RULE_LATE_PCT')?.amount).toBe(30000)
  })

  it('applies credit adjustments as earnings', () => {
    const emp = fixture.employees[3] // NADA, 1.000.000
    const { attendance } = run(emp)
    const r = computePayroll({
      compensation: emp.compensation, attendance, activity: {}, deductionRules: rules,
      adjustments: [{ direction: 'credit', category: 'BONUS', amount: 250000, keterangan: 'Bonus event' }],
      roundingUnit: 1000,
    })
    expect(r.net).toBe(1250000)
  })
})

describe('compensation history', () => {
  it('picks the version in force on the period end date', () => {
    const versions = [
      { effective_from: '2000-01-01', gaji_pokok: 900000 },
      { effective_from: '2026-09-01', gaji_pokok: 1000000 },
      { effective_from: '2026-10-01', gaji_pokok: 1200000 },
    ]
    expect(pickCompensation(versions, '2026-09-26')?.gaji_pokok).toBe(1000000)
    expect(pickCompensation(versions, '2026-08-26')?.gaji_pokok).toBe(900000)
    expect(pickCompensation(versions, '1999-01-01')).toBeNull()
  })
})
