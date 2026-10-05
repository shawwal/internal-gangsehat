// Shape of one payroll period's workspace + the pure function that turns it
// into GAJI rows. Shared by the browser (live recalculation while HR edits) and
// the server (authoritative recalculation when the period is locked).

import { computePayroll, validateEmployeeInputs, type ValidationWarning } from './engine'
import { summarizeAttendance } from './attendance'
import type {
  ActivityType, Adjustment, AttendanceCode, AttendanceSummary, Compensation, DeductionRule,
  PayrollPeriodStatus, PayrollResult, PeriodDay, Weekday,
} from './types'

export interface WorkspacePeriod {
  id: string
  branch_id: string
  branch_name: string
  period_year: number
  period_month: number
  start_date: string
  end_date: string
  days: PeriodDay[]
  workdays: number
  status: PayrollPeriodStatus
  submitted_at: string | null
  locked_at: string | null
  paid_at: string | null
  unlock_reason: string | null
}

export interface WorkspaceSettings {
  period_start_day: number
  weekly_off_days: Weekday[]
  rounding_unit: number
  max_late_days_warning: number
  clinic_name: string
  clinic_address: string
  clinic_contact: string
}

export interface WorkspaceStaff {
  id: string
  full_name: string
  nickname: string | null
  role: string
  employee_no: string | null
  jabatan: string | null
  compensation: Compensation | null
  compensation_effective_from: string | null
}

export interface ActivityCell {
  auto: number
  override: number | null
  note: string | null
}

export interface WorkspaceAdjustment extends Adjustment {
  id: string
  staff_id: string
  internal_note: string | null
  created_at: string
}

export interface SlipRecord {
  id: string
  period_id: string
  staff_id: string
  branch_id: string
  period_year: number
  period_month: number
  start_date: string
  end_date: string
  employee_no: string | null
  full_name: string
  jabatan: string | null
  attendance_summary: AttendanceSummary
  activity: Record<string, number>
  compensation: Partial<Compensation> & { effective_from?: string | null }
  lines: PayrollResult['lines']
  notes: string | null
  gross: number
  total_deductions: number
  net: number
  created_at: string
}

export interface PayrollWorkspace {
  period: WorkspacePeriod
  settings: WorkspaceSettings
  staff: WorkspaceStaff[]
  attendance: Record<string, Record<string, AttendanceCode>>
  activityTypes: ActivityType[]
  activity: Record<string, Record<string, ActivityCell>>
  adjustments: WorkspaceAdjustment[]
  deductionRules: DeductionRule[]
  slips: SlipRecord[]
  /** Which actions the viewer may take — resolved server-side from role. */
  permissions: {
    canEdit: boolean
    canApprove: boolean
    canMarkPaid: boolean
  }
}

export interface WorkspaceRow {
  staff: WorkspaceStaff
  attendance: AttendanceSummary
  activityQty: Record<string, number>
  result: PayrollResult | null
  warnings: ValidationWarning[]
}

export function activityQty(cells: Record<string, ActivityCell> | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [code, c] of Object.entries(cells ?? {})) out[code] = c.override ?? c.auto
  return out
}

export function computeWorkspaceRows(ws: PayrollWorkspace): WorkspaceRow[] {
  const limits = Object.fromEntries(ws.activityTypes.map((t) => [t.code, { label: t.label, max: t.max_per_period }]))
  return ws.staff.map((staff) => {
    const byDate = ws.attendance[staff.id] ?? {}
    const codes = ws.period.days.map((d) => byDate[d.date] ?? null)
    const attendance = summarizeAttendance(codes, ws.period.workdays)
    const qty = activityQty(ws.activity[staff.id])
    const adjustments = ws.adjustments.filter((a) => a.staff_id === staff.id)
    const result = staff.compensation
      ? computePayroll({
          compensation: staff.compensation,
          attendance,
          activity: qty,
          deductionRules: ws.deductionRules,
          adjustments,
          roundingUnit: ws.settings.rounding_unit,
        })
      : null
    const warnings = validateEmployeeInputs({
      attendance,
      activity: qty,
      activityLimits: limits,
      maxLateDays: ws.settings.max_late_days_warning,
      missingCompensation: !staff.compensation,
    })
    return { staff, attendance, activityQty: qty, result, warnings }
  })
}

const KLINIK_CODES = ['GAJI_POKOK', 'TJ_JABATAN', 'OPERASIONAL', 'INSENTIF']

/**
 * Rows for a locked/paid period, rebuilt from the immutable payroll_slips so
 * the figures never drift when compensation or rules change afterwards.
 */
export function rowsFromSlips(ws: PayrollWorkspace): WorkspaceRow[] {
  const staffById = new Map(ws.staff.map((s) => [s.id, s]))
  return ws.slips
    .map((slip) => {
      const live = slip.staff_id ? staffById.get(slip.staff_id) : undefined
      const staff: WorkspaceStaff = {
        id: slip.staff_id ?? slip.id,
        full_name: slip.full_name,
        nickname: live?.nickname ?? null,
        role: live?.role ?? '',
        employee_no: slip.employee_no,
        jabatan: slip.jabatan,
        compensation: live?.compensation ?? null,
        compensation_effective_from: live?.compensation_effective_from ?? null,
      }
      const amount = (code: string) => slip.lines.filter((l) => l.code === code).reduce((s, l) => s + l.amount, 0)
      const klinik = KLINIK_CODES.reduce((s, c) => s + amount(c), 0) - amount('POTONGAN_KEHADIRAN')
      const incentiveQty = (slip.compensation?.incentive_activity_codes ?? []).reduce((s, c) => s + (slip.activity[c] ?? 0), 0)
      const result: PayrollResult = {
        lines: slip.lines,
        klinik,
        visit: amount('VISIT'),
        gross: slip.gross,
        totalDeductions: slip.total_deductions,
        net: slip.net,
        incentiveQty,
        notes: slip.notes ?? '',
      }
      return { staff, attendance: slip.attendance_summary, activityQty: slip.activity, result, warnings: [] }
    })
    .sort((a, b) => (a.staff.employee_no ?? '~').localeCompare(b.staff.employee_no ?? '~') || a.staff.full_name.localeCompare(b.staff.full_name))
}

export function staffDisplayName(s: Pick<WorkspaceStaff, 'full_name' | 'nickname'>): string {
  return s.nickname?.trim() || s.full_name
}
