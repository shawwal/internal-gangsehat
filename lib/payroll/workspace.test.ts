import { describe, expect, it } from 'vitest'
import rawFixture from './__fixtures__/penggajian-sep-2026.json'
import { computeWorkspaceRows, rowsFromSlips, type PayrollWorkspace, type SlipRecord } from './workspace'
import type { AttendanceCode, Compensation, DeductionRule, PeriodDay } from './types'

const fixture = rawFixture as unknown as {
  period: { year: number; month: number; start: string; end: string; workdays: number }
  days: { date: string; workday: boolean }[]
  employees: {
    employee_no: string; full_name: string; alias: string; jabatan: string
    compensation: Compensation; activity: Record<string, number>; attendance: (AttendanceCode | null)[]
    adjustments: { direction: 'debit' | 'credit'; category: 'DENDA'; amount: number; keterangan: string }[]
    expected: { total_gaji: number; klinik: number; visit: number }
  }[]
  deduction_rules: DeductionRule[]
}

function buildWorkspace(): PayrollWorkspace {
  const days: PeriodDay[] = fixture.days.map((d) => ({ ...d, note: null }))
  return {
    period: {
      id: 'p1', branch_id: 'b1', branch_name: 'Pontianak', period_year: 2026, period_month: 9,
      start_date: fixture.period.start, end_date: fixture.period.end, days, workdays: fixture.period.workdays,
      status: 'draft', submitted_at: null, locked_at: null, paid_at: null, unlock_reason: null,
    },
    settings: {
      period_start_day: 27, weekly_off_days: ['JUMAT'], rounding_unit: 1000, max_late_days_warning: 4,
      clinic_name: 'Fisioterapi Gang Sehat', clinic_address: '', clinic_contact: '',
    },
    staff: fixture.employees.map((e) => ({
      id: e.employee_no, full_name: e.full_name, nickname: e.alias, role: 'therapist',
      employee_no: e.employee_no, jabatan: e.jabatan, compensation: e.compensation, compensation_effective_from: '2026-08-27',
    })),
    attendance: Object.fromEntries(fixture.employees.map((e) => [
      e.employee_no,
      Object.fromEntries(days.map((d, i) => [d.date, e.attendance[i]]).filter(([, c]) => c !== null)),
    ])),
    activityTypes: [],
    activity: Object.fromEntries(fixture.employees.map((e) => [
      e.employee_no,
      Object.fromEntries(Object.entries(e.activity).map(([k, v]) => [k, { auto: 0, override: v, note: null }])),
    ])),
    adjustments: fixture.employees.flatMap((e, i) => e.adjustments.map((a) => ({
      ...a, id: `a${i}`, staff_id: e.employee_no, internal_note: null, created_at: '2026-09-26',
    }))),
    deductionRules: fixture.deduction_rules,
    slips: [],
    permissions: { canEdit: true, canApprove: true, canMarkPaid: true },
  }
}

describe('payroll workspace', () => {
  it('computes the GAJI sheet from a full workspace', () => {
    const rows = computeWorkspaceRows(buildWorkspace())
    expect(rows.reduce((s, r) => s + (r.result?.net ?? 0), 0)).toBe(42040000)
  })

  it('rebuilds identical figures from frozen slips once locked', () => {
    const ws = buildWorkspace()
    const live = computeWorkspaceRows(ws)
    const slips: SlipRecord[] = live.map((r, i) => ({
      id: `s${i}`, period_id: 'p1', staff_id: r.staff.id, branch_id: 'b1', period_year: 2026, period_month: 9,
      start_date: ws.period.start_date, end_date: ws.period.end_date, employee_no: r.staff.employee_no,
      full_name: r.staff.full_name, jabatan: r.staff.jabatan, compensation: { ...r.staff.compensation! },
      attendance_summary: r.attendance, activity: r.activityQty, lines: r.result!.lines, notes: r.result!.notes || null,
      gross: r.result!.gross, total_deductions: r.result!.totalDeductions, net: r.result!.net, created_at: '2026-09-27',
    }))
    // Change compensation afterwards: frozen rows must not move.
    const later = { ...ws, staff: ws.staff.map((s) => ({ ...s, compensation: { ...s.compensation!, gaji_pokok: 9_999_999 } })), slips }
    const frozen = rowsFromSlips(later)
    for (const e of fixture.employees) {
      const row = frozen.find((r) => r.staff.employee_no === e.employee_no)!
      expect(row.result!.net).toBe(e.expected.total_gaji)
      expect(row.result!.klinik).toBe(e.expected.klinik)
      expect(row.result!.visit).toBe(e.expected.visit)
      expect(row.result!.incentiveQty).toBe(live.find((r) => r.staff.id === e.employee_no)!.result!.incentiveQty)
    }
  })
})
