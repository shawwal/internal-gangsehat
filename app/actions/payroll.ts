'use server'

// Payroll workspace server actions. Every query runs through the caller's
// Supabase session, so RLS (095-payroll-engine.sql) scopes data per branch and
// the DB triggers enforce the lock/approval rules; the role checks here only
// produce friendlier errors.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activityLog'
import { buildPeriodDays, countWorkdays, MONTH_NAMES } from '@/lib/payroll/period'
import { codeFromRow, rowFromCode, type AttendanceDbRow } from '@/lib/payroll/attendance'
import { pickCompensation } from '@/lib/payroll/engine'
import { computeAutoActivity, VISIT_FOR_PAYROLL_COLUMNS, type VisitForPayroll } from '@/lib/payroll/autoActivity'
import {
  computeWorkspaceRows, type ActivityCell, type PayrollWorkspace, type SlipRecord, type WorkspaceAdjustment,
  type WorkspaceSettings, type WorkspaceStaff,
} from '@/lib/payroll/workspace'
import type {
  ActivityType, Adjustment, AttendanceCode, Compensation, DeductionRule, PayrollPeriodStatus, PeriodDay, Weekday,
} from '@/lib/payroll/types'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }
type Result<T = null> = Ok<T> | Err

const ok = <T>(data: T): Ok<T> => ({ ok: true, data })
const fail = (error: string): Err => ({ ok: false, error })

const PREP_ROLES = ['director', 'hr', 'manager']
const APPROVE_ROLES = ['director', 'manager']
const PAID_ROLES = ['director', 'manager', 'finance']
const VIEW_ROLES = [...PREP_ROLES, 'finance']
/** Roles never bound to a payroll period automatically. */
const NON_PAYROLL_ROLES = ['director', 'non-staff']

type ServerClient = Awaited<ReturnType<typeof createClient>>

interface Actor {
  supabase: ServerClient
  userId: string
  role: string
  branchId: string | null
}

async function getActor(allowed: string[]): Promise<Actor | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Sesi berakhir, silakan login ulang.')
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile || !allowed.includes(profile.role)) return fail('Anda tidak memiliki akses ke fitur ini.')
  return { supabase, userId: user.id, role: profile.role, branchId: profile.branch_id }
}

const isErr = (x: unknown): x is Err => typeof x === 'object' && x !== null && (x as Err).ok === false

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

// ── Shared loaders ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: WorkspaceSettings = {
  period_start_day: 27,
  weekly_off_days: ['JUMAT'],
  rounding_unit: 1000,
  max_late_days_warning: 4,
  clinic_name: 'Fisioterapi Gang Sehat',
  clinic_address: '',
  clinic_contact: '',
}

async function loadSettings(supabase: ServerClient, branchId: string): Promise<WorkspaceSettings> {
  const { data } = await supabase
    .from('payroll_settings')
    .select('branch_id, period_start_day, weekly_off_days, rounding_unit, max_late_days_warning, clinic_name, clinic_address, clinic_contact')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
  const rows = data ?? []
  const row = rows.find((r) => r.branch_id === branchId) ?? rows.find((r) => r.branch_id === null)
  if (!row) return DEFAULT_SETTINGS
  return {
    period_start_day: row.period_start_day,
    weekly_off_days: (row.weekly_off_days ?? []) as Weekday[],
    rounding_unit: row.rounding_unit,
    max_late_days_warning: row.max_late_days_warning,
    clinic_name: row.clinic_name,
    clinic_address: row.clinic_address,
    clinic_contact: row.clinic_contact,
  }
}

async function loadDeductionRules(supabase: ServerClient, branchId: string): Promise<DeductionRule[]> {
  const { data } = await supabase
    .from('payroll_deduction_rules')
    .select('branch_id, code, label, basis, calc_type, amount, is_active, sort_order')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
  // Branch rows override global rows with the same code.
  const byCode = new Map<string, DeductionRule & { branch_id: string | null }>()
  for (const r of (data ?? []) as (DeductionRule & { branch_id: string | null })[]) {
    const existing = byCode.get(r.code)
    if (!existing || (existing.branch_id === null && r.branch_id !== null)) byCode.set(r.code, { ...r, amount: Number(r.amount) })
  }
  return [...byCode.values()].map((r) => ({
    code: r.code, label: r.label, basis: r.basis, calc_type: r.calc_type, amount: r.amount, is_active: r.is_active, sort_order: r.sort_order,
  }))
}

async function loadHolidays(supabase: ServerClient, branchId: string, start: string, end: string) {
  const { data } = await supabase
    .from('payroll_holidays')
    .select('date, name, branch_id')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
    .gte('date', start)
    .lte('date', end)
  return (data ?? []) as { date: string; name: string }[]
}

async function loadActivityTypes(supabase: ServerClient): Promise<ActivityType[]> {
  const { data } = await supabase
    .from('payroll_activity_types')
    .select('code, label, group_label, count_mode, source_service_types, source_layanan_ids, max_per_period, sort_order, is_active')
    .order('sort_order')
  return (data ?? []) as ActivityType[]
}

function normalizeCompensation(row: Record<string, unknown>): Compensation {
  return {
    gaji_pokok: Number(row.gaji_pokok ?? 0),
    tj_jabatan: Number(row.tj_jabatan ?? 0),
    operasional: Number(row.operasional ?? 0),
    operasional_mode: (row.operasional_mode as Compensation['operasional_mode']) ?? 'prorata',
    operasional_threshold: Number(row.operasional_threshold ?? 0.75),
    operasional_daily_rate: Number(row.operasional_daily_rate ?? 0),
    insentif_base: Number(row.insentif_base ?? 0),
    incentive_target: Number(row.incentive_target ?? 0),
    incentive_activity_codes: (row.incentive_activity_codes as string[]) ?? [],
    bonus_tiers: ((row.bonus_tiers as Compensation['bonus_tiers']) ?? []).map((t) => ({ ...t, min_qty: Number(t.min_qty), amount: Number(t.amount) })),
    activity_rates: Object.fromEntries(
      Object.entries((row.activity_rates as Record<string, number>) ?? {}).map(([k, v]) => [k, Number(v)]),
    ),
  }
}

interface PeriodRow {
  id: string
  branch_id: string
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
  branches: { name: string } | null
}

async function loadPeriod(supabase: ServerClient, periodId: string): Promise<PeriodRow | null> {
  const { data } = await supabase
    .from('payroll_periods')
    .select('id, branch_id, period_year, period_month, start_date, end_date, days, workdays, status, submitted_at, locked_at, paid_at, unlock_reason, branches!branch_id(name)')
    .eq('id', periodId)
    .maybeSingle()
  return (data as unknown as PeriodRow) ?? null
}

const periodLabelOf = (p: Pick<PeriodRow, 'period_year' | 'period_month'>) => `${MONTH_NAMES[p.period_month - 1]} ${p.period_year}`

function friendly(msg: string): string {
  if (msg.includes('dikunci') || msg.includes('Hanya ')) return msg.replace(/^.*?ERROR:\s*/, '')
  if (msg.includes('employee_payroll_profiles_employee_no_key')) return 'No. karyawan sudah dipakai karyawan lain.'
  if (msg.includes('payroll_periods_branch_id_period_year_period_month_key')) return 'Periode ini sudah ada.'
  return msg
}

// ── Branches & period list ──────────────────────────────────────────────────

export interface PayrollPeriodSummary {
  id: string
  period_year: number
  period_month: number
  status: PayrollPeriodStatus
  workdays: number
  staff_count: number
  net_total: number | null
}

export async function getPayrollBootstrap(): Promise<Result<{
  role: string
  branchId: string | null
  branches: { id: string; name: string }[]
}>> {
  const actor = await getActor(VIEW_ROLES)
  if (isErr(actor)) return actor
  let q = actor.supabase.from('branches').select('id, name').eq('is_active', true).order('name')
  if (actor.role !== 'director') {
    if (!actor.branchId) return fail('Akun Anda belum terhubung ke cabang.')
    q = q.eq('id', actor.branchId)
  }
  const { data } = await q
  return ok({ role: actor.role, branchId: actor.branchId, branches: data ?? [] })
}

export async function listPayrollPeriods(branchId: string): Promise<Result<PayrollPeriodSummary[]>> {
  const actor = await getActor(VIEW_ROLES)
  if (isErr(actor)) return actor
  const { data, error } = await actor.supabase
    .from('payroll_periods')
    .select('id, period_year, period_month, status, workdays, payroll_period_staff(count), payroll_slips(net)')
    .eq('branch_id', branchId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
  if (error) return fail(error.message)
  type Row = {
    id: string; period_year: number; period_month: number; status: PayrollPeriodStatus; workdays: number
    payroll_period_staff: { count: number }[]; payroll_slips: { net: number }[]
  }
  return ok(((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    period_year: r.period_year,
    period_month: r.period_month,
    status: r.status,
    workdays: r.workdays,
    staff_count: r.payroll_period_staff?.[0]?.count ?? 0,
    net_total: r.payroll_slips?.length ? r.payroll_slips.reduce((s, x) => s + Number(x.net), 0) : null,
  })))
}

// ── Period initialization ───────────────────────────────────────────────────

// Staff that must not appear in a period: deactivated accounts, and anyone
// marked "tidak diikutkan penggajian" (or terminated before the period) on
// the Pengaturan Penggajian page.
async function excludedFromPayroll(supabase: ServerClient, staffIds: string[], start: string): Promise<Set<string>> {
  if (!staffIds.length) return new Set()
  const [{ data: staff }, { data: profiles }] = await Promise.all([
    supabase.from('internal_profiles').select('id, is_active').in('id', staffIds),
    supabase.from('employee_payroll_profiles').select('staff_id, include_in_payroll, termination_date').in('staff_id', staffIds),
  ])
  return new Set([
    ...(staff ?? []).filter((s) => !s.is_active).map((s) => s.id),
    ...(profiles ?? [])
      .filter((p) => !p.include_in_payroll || (p.termination_date && p.termination_date < start))
      .map((p) => p.staff_id),
  ])
}

async function eligibleStaffIds(supabase: ServerClient, branchId: string, start: string): Promise<string[]> {
  const { data: staff } = await supabase
    .from('internal_profiles')
    .select('id, role')
    .eq('branch_id', branchId)
    .eq('is_active', true)
  const candidates = (staff ?? []).filter((s) => !NON_PAYROLL_ROLES.includes(s.role)).map((s) => s.id)
  const excluded = await excludedFromPayroll(supabase, candidates, start)
  return candidates.filter((id) => !excluded.has(id))
}

/** Opens (creating if needed) the period for branch/year/month and returns its id. */
export async function openPayrollPeriod(branchId: string, year: number, month: number): Promise<Result<string>> {
  const actor = await getActor(VIEW_ROLES)
  if (isErr(actor)) return actor
  const { supabase } = actor

  const { data: existing } = await supabase
    .from('payroll_periods')
    .select('id')
    .eq('branch_id', branchId)
    .eq('period_year', year)
    .eq('period_month', month)
    .maybeSingle()
  if (existing) return ok(existing.id)
  if (!PREP_ROLES.includes(actor.role)) return fail('Periode ini belum dibuat oleh HR.')

  const settings = await loadSettings(supabase, branchId)
  // Range first (holidays are looked up inside it), then build the days.
  const probe = buildPeriodDays(year, month, { startDay: settings.period_start_day, weeklyOffDays: [], holidays: [] })
  const holidays = await loadHolidays(supabase, branchId, probe.start, probe.end)
  const built = buildPeriodDays(year, month, {
    startDay: settings.period_start_day,
    weeklyOffDays: settings.weekly_off_days,
    holidays,
  })

  const { data: period, error } = await supabase
    .from('payroll_periods')
    .insert({
      branch_id: branchId,
      period_year: year,
      period_month: month,
      start_date: built.start,
      end_date: built.end,
      days: built.days,
      workdays: built.workdays,
      created_by: actor.userId,
    })
    .select('id')
    .single()
  if (error || !period) return fail(friendly(error?.message ?? 'Gagal membuat periode.'))

  const staffIds = await eligibleStaffIds(supabase, branchId, built.start)
  if (staffIds.length) {
    await supabase.from('payroll_period_staff').insert(staffIds.map((staff_id) => ({ period_id: period.id, staff_id })))
  }
  await refreshActivityFor(supabase, period.id, actor.userId)

  logActivity({
    supabase, userId: actor.userId, action: 'create', resourceType: 'payroll_period',
    resourceId: period.id, resourceLabel: `Penggajian ${MONTH_NAMES[month - 1]} ${year}`, branchId,
    newValues: { start_date: built.start, end_date: built.end, workdays: built.workdays, staff: staffIds.length },
  })
  return ok(period.id)
}

// ── Workspace ───────────────────────────────────────────────────────────────

export async function getPayrollWorkspace(periodId: string): Promise<Result<PayrollWorkspace>> {
  const actor = await getActor(VIEW_ROLES)
  if (isErr(actor)) return actor
  const { supabase } = actor

  const period = await loadPeriod(supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')

  const { data: bound } = await supabase.from('payroll_period_staff').select('staff_id').eq('period_id', periodId)
  let staffIds = (bound ?? []).map((b) => b.staff_id)

  // An open period follows the current settings: staff deactivated or switched
  // to "tidak diikutkan penggajian" after it was opened drop out (and are
  // unbound so lock/activity refresh skip them too). Locked periods keep the
  // roster their slips were written for.
  const open = period.status === 'draft' || period.status === 'submitted'
  if (open) {
    const excluded = await excludedFromPayroll(supabase, staffIds, period.start_date)
    if (excluded.size) {
      staffIds = staffIds.filter((id) => !excluded.has(id))
      if (PREP_ROLES.includes(actor.role) || APPROVE_ROLES.includes(actor.role)) {
        await supabase.from('payroll_period_staff').delete().eq('period_id', periodId).in('staff_id', [...excluded])
      }
    }
  }

  const [settings, deductionRules, activityTypes, profilesRes, payrollProfilesRes, compRes, attendanceRes, countsRes, adjRes, slipsRes] =
    await Promise.all([
      loadSettings(supabase, period.branch_id),
      loadDeductionRules(supabase, period.branch_id),
      loadActivityTypes(supabase),
      staffIds.length
        ? supabase.from('internal_profiles').select('id, full_name, nickname, role').in('id', staffIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; nickname: string | null; role: string }[] }),
      staffIds.length
        ? supabase.from('employee_payroll_profiles').select('staff_id, employee_no, jabatan').in('staff_id', staffIds)
        : Promise.resolve({ data: [] as { staff_id: string; employee_no: string | null; jabatan: string | null }[] }),
      staffIds.length
        ? supabase.from('employee_compensation').select('*').in('staff_id', staffIds).lte('effective_from', period.end_date)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      staffIds.length
        ? supabase.from('attendance').select('staff_id, date, status, late_minutes').in('staff_id', staffIds)
            .gte('date', period.start_date).lte('date', period.end_date)
        : Promise.resolve({ data: [] as AttendanceDbRow[] }),
      supabase.from('payroll_activity_counts').select('staff_id, activity_code, auto_qty, override_qty, note').eq('period_id', periodId),
      supabase.from('payroll_adjustments')
        .select('id, staff_id, direction, category, amount, keterangan, internal_note, created_at')
        .eq('period_id', periodId).order('created_at'),
      supabase.from('payroll_slips').select('*').eq('period_id', periodId),
    ])

  const payrollProfiles = new Map((payrollProfilesRes.data ?? []).map((p) => [p.staff_id, p]))
  const compByStaff = new Map<string, Record<string, unknown>[]>()
  for (const c of (compRes.data ?? []) as Record<string, unknown>[]) {
    const id = c.staff_id as string
    compByStaff.set(id, [...(compByStaff.get(id) ?? []), c])
  }

  const staff: WorkspaceStaff[] = (profilesRes.data ?? []).map((p) => {
    const versions = (compByStaff.get(p.id) ?? []) as ({ effective_from: string } & Record<string, unknown>)[]
    const current = pickCompensation(versions, period.end_date)
    const pp = payrollProfiles.get(p.id)
    return {
      id: p.id,
      full_name: p.full_name,
      nickname: p.nickname,
      role: p.role,
      employee_no: pp?.employee_no ?? null,
      jabatan: pp?.jabatan ?? null,
      compensation: current ? normalizeCompensation(current) : null,
      compensation_effective_from: current?.effective_from ?? null,
    }
  }).sort((a, b) => (a.employee_no ?? '~').localeCompare(b.employee_no ?? '~') || a.full_name.localeCompare(b.full_name))

  const attendance: Record<string, Record<string, AttendanceCode>> = {}
  for (const row of (attendanceRes.data ?? []) as AttendanceDbRow[]) {
    attendance[row.staff_id] ??= {}
    attendance[row.staff_id][row.date] = codeFromRow(row)
  }

  const activity: Record<string, Record<string, ActivityCell>> = {}
  for (const c of countsRes.data ?? []) {
    activity[c.staff_id] ??= {}
    activity[c.staff_id][c.activity_code] = {
      auto: Number(c.auto_qty),
      override: c.override_qty === null ? null : Number(c.override_qty),
      note: c.note,
    }
  }

  const adjustments: WorkspaceAdjustment[] = ((adjRes.data ?? []) as WorkspaceAdjustment[]).map((a) => ({ ...a, amount: Number(a.amount) }))
  const slips = ((slipsRes.data ?? []) as SlipRecord[]).map((s) => ({
    ...s, gross: Number(s.gross), total_deductions: Number(s.total_deductions), net: Number(s.net),
  }))

  return ok({
    period: {
      id: period.id,
      branch_id: period.branch_id,
      branch_name: period.branches?.name ?? '—',
      period_year: period.period_year,
      period_month: period.period_month,
      start_date: period.start_date,
      end_date: period.end_date,
      days: period.days,
      workdays: period.workdays,
      status: period.status,
      submitted_at: period.submitted_at,
      locked_at: period.locked_at,
      paid_at: period.paid_at,
      unlock_reason: period.unlock_reason,
    },
    settings,
    staff,
    attendance,
    activityTypes: activityTypes.filter((t) => t.is_active),
    activity,
    adjustments,
    deductionRules,
    slips,
    permissions: {
      canEdit: open && PREP_ROLES.includes(actor.role),
      canApprove: APPROVE_ROLES.includes(actor.role),
      canMarkPaid: PAID_ROLES.includes(actor.role),
    },
  })
}

// ── Calendar ────────────────────────────────────────────────────────────────

export async function updatePeriodDay(periodId: string, date: string, workday: boolean, note: string | null): Promise<Result<{ workdays: number }>> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const period = await loadPeriod(actor.supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')
  const days = period.days.map((d) => (d.date === date ? { ...d, workday, note: note?.trim() || null } : d))
  const workdays = countWorkdays(days)
  const { error } = await actor.supabase.from('payroll_periods').update({ days, workdays }).eq('id', periodId)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_period',
    resourceId: periodId, resourceLabel: `Kalender ${periodLabelOf(period)}`, branchId: period.branch_id,
    oldValues: { [date]: period.days.find((d) => d.date === date)?.workday ?? null, workdays: period.workdays },
    newValues: { [date]: workday, workdays },
  })
  return ok({ workdays })
}

// ── Attendance (ABS) ────────────────────────────────────────────────────────

export interface AttendanceCellInput {
  staffId: string
  date: string
  code: AttendanceCode | null
}

export async function saveAttendanceCells(periodId: string, cells: AttendanceCellInput[]): Promise<Result<{ saved: number }>> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const { supabase } = actor
  if (!cells.length) return ok({ saved: 0 })
  if (cells.length > 2000) return fail('Terlalu banyak sel sekaligus.')

  const period = await loadPeriod(supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.status !== 'draft' && period.status !== 'submitted') return fail('Periode sudah dikunci.')

  const { data: bound } = await supabase.from('payroll_period_staff').select('staff_id').eq('period_id', periodId)
  const allowed = new Set((bound ?? []).map((b) => b.staff_id))

  for (const c of cells) {
    if (!allowed.has(c.staffId)) return fail('Karyawan tidak terdaftar di periode ini.')
    if (c.date < period.start_date || c.date > period.end_date) return fail(`Tanggal ${c.date} di luar periode.`)
    if (typeof c.code === 'number' && (!Number.isInteger(c.code) || c.code < 0 || c.code > 600)) {
      return fail('Menit terlambat harus bilangan bulat 0–600.')
    }
  }

  const upserts = cells.filter((c) => c.code !== null).map((c) => ({
    staff_id: c.staffId,
    branch_id: period.branch_id,
    date: c.date,
    ...rowFromCode(c.code as AttendanceCode),
    recorded_by: actor.userId,
  }))
  const deletes = cells.filter((c) => c.code === null)

  if (upserts.length) {
    const { error } = await supabase.from('attendance').upsert(upserts, { onConflict: 'staff_id,date' })
    if (error) return fail(friendly(error.message))
  }
  for (const d of deletes) {
    const { error } = await supabase.from('attendance').delete().eq('staff_id', d.staffId).eq('date', d.date)
    if (error) return fail(friendly(error.message))
  }

  logActivity({
    supabase, userId: actor.userId, action: 'update', resourceType: 'attendance',
    resourceId: periodId, resourceLabel: `Absensi ${periodLabelOf(period)}`, branchId: period.branch_id,
    newValues: {
      cells: cells.slice(0, 50).map((c) => `${c.staffId.slice(0, 8)} ${c.date} ${c.code ?? '—'}`),
      total: cells.length,
    },
  })
  return ok({ saved: cells.length })
}

// ── Activity counts (AUTO INS / INS) ────────────────────────────────────────

async function refreshActivityFor(supabase: ServerClient, periodId: string, userId: string): Promise<Result<{ updated: number }>> {
  const period = await loadPeriod(supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.status !== 'draft' && period.status !== 'submitted') return fail('Periode sudah dikunci.')

  const [{ data: bound }, types] = await Promise.all([
    supabase.from('payroll_period_staff').select('staff_id').eq('period_id', periodId),
    loadActivityTypes(supabase),
  ])
  const staffIds = (bound ?? []).map((b) => b.staff_id)
  const autoTypes = types.filter((t) => t.is_active && t.count_mode !== 'manual' && t.source_service_types.length)
  if (!staffIds.length || !autoTypes.length) return ok({ updated: 0 })

  const serviceTypes = [...new Set(autoTypes.flatMap((t) => t.source_service_types))]
  const { data: visits, error } = await supabase
    .from('patient_visits')
    .select(VISIT_FOR_PAYROLL_COLUMNS)
    .in('attending_staff_id', staffIds)
    .in('service_type', serviceTypes)
    .in('status', ['scheduled', 'completed'])
    .gte('visit_date', period.start_date)
    .lte('visit_date', period.end_date)
    .limit(20000)
  if (error) return fail(error.message)
  const periodVisits = (visits ?? []) as VisitForPayroll[]

  // Earliest attended session of every package seen this period, to credit each
  // package sale exactly once (in the period its first session falls in).
  const today = todayJakarta()
  const packageIds = [...new Set(periodVisits.map((v) => v.package_id).filter((x): x is string => !!x))]
  const firstPackageVisit = new Map<string, VisitForPayroll>()
  for (let i = 0; i < packageIds.length; i += 300) {
    const { data: pv } = await supabase
      .from('patient_visits')
      .select(VISIT_FOR_PAYROLL_COLUMNS)
      .in('package_id', packageIds.slice(i, i + 300))
      .in('status', ['scheduled', 'completed'])
      .lte('visit_date', period.end_date)
      .order('visit_date', { ascending: true })
    for (const v of (pv ?? []) as VisitForPayroll[]) {
      if (!v.package_id || firstPackageVisit.has(v.package_id)) continue
      if (v.kehadiran === 'HADIR' || (v.kehadiran == null && v.visit_date < today)) firstPackageVisit.set(v.package_id, v)
    }
  }

  const counts = computeAutoActivity({
    types: autoTypes, periodVisits, firstPackageVisit, staffIds,
    start: period.start_date, end: period.end_date, todayISO: today,
  })

  const rows = staffIds.flatMap((staffId) =>
    autoTypes.map((t) => ({
      period_id: periodId,
      staff_id: staffId,
      activity_code: t.code,
      auto_qty: counts[staffId]?.[t.code] ?? 0,
      updated_by: userId,
    })),
  )
  // Upsert only auto_qty — HR overrides and notes are preserved.
  const { error: upErr } = await supabase
    .from('payroll_activity_counts')
    .upsert(rows, { onConflict: 'period_id,staff_id,activity_code' })
  if (upErr) return fail(friendly(upErr.message))
  return ok({ updated: rows.length })
}

export async function refreshAutoActivity(periodId: string): Promise<Result<{ updated: number }>> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const res = await refreshActivityFor(actor.supabase, periodId, actor.userId)
  if (res.ok) {
    logActivity({
      supabase: actor.supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_activity',
      resourceId: periodId, resourceLabel: 'Tarik ulang data sesi otomatis', newValues: { rows: res.data.updated },
    })
  }
  return res
}

export async function setActivityOverride(
  periodId: string, staffId: string, code: string, value: number | null, note: string | null,
): Promise<Result> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const { supabase } = actor
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 5000)) {
    return fail('Jumlah harus angka 0 – 5000.')
  }
  const { data: before } = await supabase
    .from('payroll_activity_counts')
    .select('auto_qty, override_qty, note')
    .eq('period_id', periodId).eq('staff_id', staffId).eq('activity_code', code)
    .maybeSingle()
  const { error } = await supabase.from('payroll_activity_counts').upsert({
    period_id: periodId,
    staff_id: staffId,
    activity_code: code,
    auto_qty: before?.auto_qty ?? 0,
    override_qty: value,
    note: note?.trim() || null,
    updated_by: actor.userId,
  }, { onConflict: 'period_id,staff_id,activity_code' })
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_activity',
    resourceId: `${periodId}:${staffId}:${code}`, resourceLabel: code,
    oldValues: { override_qty: before?.override_qty ?? null, note: before?.note ?? null },
    newValues: { override_qty: value, note: note?.trim() || null },
  })
  return ok(null)
}

// ── Adjustments (DENDA ledger) ──────────────────────────────────────────────

export async function addPayrollAdjustment(input: {
  periodId: string
  staffId: string
  direction: Adjustment['direction']
  category: Adjustment['category']
  amount: number
  keterangan: string
  internalNote?: string | null
}): Promise<Result<string>> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  if (!input.keterangan.trim()) return fail('Keterangan wajib diisi.')
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1_000_000_000) return fail('Nominal tidak valid.')
  if (!['debit', 'credit'].includes(input.direction)) return fail('Jenis penyesuaian tidak valid.')
  if (!['DENDA', 'BONUS', 'KOREKSI', 'LAINNYA'].includes(input.category)) return fail('Kategori tidak valid.')

  const row = {
    period_id: input.periodId,
    staff_id: input.staffId,
    direction: input.direction,
    category: input.category,
    amount: Math.round(input.amount),
    keterangan: input.keterangan.trim(),
    internal_note: input.internalNote?.trim() || null,
    created_by: actor.userId,
  }
  const { data, error } = await actor.supabase.from('payroll_adjustments').insert(row).select('id').single()
  if (error || !data) return fail(friendly(error?.message ?? 'Gagal menyimpan.'))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'create', resourceType: 'payroll_adjustment',
    resourceId: data.id, resourceLabel: `${row.category} ${row.keterangan}`, newValues: row,
  })
  return ok(data.id)
}

export async function deletePayrollAdjustment(id: string): Promise<Result> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const { data: before } = await actor.supabase.from('payroll_adjustments').select('*').eq('id', id).maybeSingle()
  const { error } = await actor.supabase.from('payroll_adjustments').delete().eq('id', id)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'delete', resourceType: 'payroll_adjustment',
    resourceId: id, resourceLabel: before ? `${before.category} ${before.keterangan}` : null, oldValues: before ?? null,
  })
  return ok(null)
}

// ── Staff binding ───────────────────────────────────────────────────────────

export async function listBindableStaff(periodId: string): Promise<Result<{ id: string; full_name: string }[]>> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const period = await loadPeriod(actor.supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')
  const { data: bound } = await actor.supabase.from('payroll_period_staff').select('staff_id').eq('period_id', periodId)
  const boundIds = new Set((bound ?? []).map((b) => b.staff_id))
  const { data } = await actor.supabase
    .from('internal_profiles')
    .select('id, full_name, role')
    .eq('branch_id', period.branch_id)
    .eq('is_active', true)
    .order('full_name')
  const candidates = (data ?? []).filter((s) => !boundIds.has(s.id) && s.role !== 'non-staff')
  const excluded = await excludedFromPayroll(actor.supabase, candidates.map((s) => s.id), period.start_date)
  return ok(candidates.filter((s) => !excluded.has(s.id)).map((s) => ({ id: s.id, full_name: s.full_name })))
}

export async function setPeriodStaff(periodId: string, staffId: string, include: boolean): Promise<Result> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const { error } = include
    ? await actor.supabase.from('payroll_period_staff').insert({ period_id: periodId, staff_id: staffId })
    : await actor.supabase.from('payroll_period_staff').delete().eq('period_id', periodId).eq('staff_id', staffId)
  if (error) return fail(friendly(error.message))
  if (include) await refreshActivityFor(actor.supabase, periodId, actor.userId)
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: include ? 'create' : 'delete', resourceType: 'payroll_period',
    resourceId: periodId, resourceLabel: include ? 'Tambah karyawan ke periode' : 'Keluarkan karyawan dari periode',
    newValues: { staff_id: staffId },
  })
  return ok(null)
}

// ── Workflow ────────────────────────────────────────────────────────────────

async function notify(rows: { user_id?: string; target_role?: string; title: string; message: string; link: string }[]) {
  if (!rows.length) return
  try {
    await createAdminClient().from('user_notifications').insert(rows)
  } catch (err) {
    console.error('[payroll] notification failed', err)
  }
}

export async function submitPayrollPeriod(periodId: string): Promise<Result> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const period = await loadPeriod(actor.supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.status !== 'draft') return fail('Hanya periode draft yang dapat diajukan.')
  const { error } = await actor.supabase
    .from('payroll_periods')
    .update({ status: 'submitted', submitted_by: actor.userId, submitted_at: new Date().toISOString() })
    .eq('id', periodId)
  if (error) return fail(friendly(error.message))
  await notify([{
    target_role: 'director',
    title: 'Penggajian Menunggu Persetujuan',
    message: `${period.branches?.name ?? ''} · ${periodLabelOf(period)}`,
    link: `/payroll?period=${periodId}`,
  }])
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_period',
    resourceId: periodId, resourceLabel: `Penggajian ${periodLabelOf(period)}`, branchId: period.branch_id,
    oldValues: { status: period.status }, newValues: { status: 'submitted' },
  })
  return ok(null)
}

export async function withdrawPayrollSubmission(periodId: string): Promise<Result> {
  const actor = await getActor(PREP_ROLES)
  if (isErr(actor)) return actor
  const period = await loadPeriod(actor.supabase, periodId)
  if (!period || period.status !== 'submitted') return fail('Periode tidak sedang diajukan.')
  const { error } = await actor.supabase.from('payroll_periods').update({ status: 'draft' }).eq('id', periodId)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_period',
    resourceId: periodId, resourceLabel: `Penggajian ${periodLabelOf(period)}`, branchId: period.branch_id,
    oldValues: { status: 'submitted' }, newValues: { status: 'draft' },
  })
  return ok(null)
}

/**
 * Approve & lock: recompute every row server-side from the stored inputs,
 * write immutable payroll_slips, freeze the rule set, notify staff.
 */
export async function lockPayrollPeriod(periodId: string): Promise<Result<{ slips: number; total: number }>> {
  const actor = await getActor(APPROVE_ROLES)
  if (isErr(actor)) return actor
  const { supabase } = actor

  const wsRes = await getPayrollWorkspace(periodId)
  if (!wsRes.ok) return wsRes
  const ws = wsRes.data
  if (ws.period.status !== 'draft' && ws.period.status !== 'submitted') return fail('Periode sudah dikunci.')
  if (!ws.staff.length) return fail('Belum ada karyawan di periode ini.')

  const rows = computeWorkspaceRows(ws)
  const missing = rows.filter((r) => !r.result).map((r) => r.staff.full_name)
  if (missing.length) return fail(`Data kompensasi belum lengkap: ${missing.join(', ')}`)

  // Clear leftovers from an interrupted earlier attempt (period is still open).
  await supabase.from('payroll_slips').delete().eq('period_id', periodId)

  const slips = rows.map((r) => ({
    period_id: periodId,
    staff_id: r.staff.id,
    branch_id: ws.period.branch_id,
    period_year: ws.period.period_year,
    period_month: ws.period.period_month,
    start_date: ws.period.start_date,
    end_date: ws.period.end_date,
    employee_no: r.staff.employee_no,
    full_name: r.staff.full_name,
    jabatan: r.staff.jabatan,
    compensation: { ...r.staff.compensation, effective_from: r.staff.compensation_effective_from },
    attendance_summary: r.attendance,
    activity: r.activityQty,
    lines: r.result!.lines,
    notes: r.result!.notes || null,
    gross: r.result!.gross,
    total_deductions: r.result!.totalDeductions,
    net: r.result!.net,
  }))
  const { error: slipErr } = await supabase.from('payroll_slips').insert(slips)
  if (slipErr) return fail(friendly(slipErr.message))

  const { error: lockErr } = await supabase
    .from('payroll_periods')
    .update({
      status: 'locked',
      locked_by: actor.userId,
      locked_at: new Date().toISOString(),
      unlock_reason: null,
      settings_snapshot: {
        settings: ws.settings,
        deduction_rules: ws.deductionRules,
        activity_types: ws.activityTypes,
        workdays: ws.period.workdays,
      },
    })
    .eq('id', periodId)
  if (lockErr) {
    await supabase.from('payroll_slips').delete().eq('period_id', periodId)
    return fail(friendly(lockErr.message))
  }

  const total = slips.reduce((s, x) => s + x.net, 0)
  const label = `${MONTH_NAMES[ws.period.period_month - 1]} ${ws.period.period_year}`
  await notify([
    ...slips.map((s) => ({
      user_id: s.staff_id,
      title: 'Slip Gaji Tersedia',
      message: `Slip gaji ${label} sudah dapat dilihat.`,
      link: '/my-payslips',
    })),
    { target_role: 'finance', title: 'Penggajian Disetujui', message: `${ws.period.branch_name} · ${label}`, link: `/payroll?period=${periodId}` },
  ])
  logActivity({
    supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_period',
    resourceId: periodId, resourceLabel: `Penggajian ${label}`, branchId: ws.period.branch_id,
    oldValues: { status: ws.period.status }, newValues: { status: 'locked', slips: slips.length, total },
  })
  return ok({ slips: slips.length, total })
}

export async function unlockPayrollPeriod(periodId: string, reason: string): Promise<Result> {
  const actor = await getActor(APPROVE_ROLES)
  if (isErr(actor)) return actor
  if (!reason.trim()) return fail('Alasan membuka kunci wajib diisi.')
  const period = await loadPeriod(actor.supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.status === 'paid') return fail('Periode sudah dibayar dan tidak dapat dibuka kembali.')
  if (period.status !== 'locked') return fail('Periode belum dikunci.')

  const { error } = await actor.supabase
    .from('payroll_periods')
    .update({ status: 'draft', unlock_reason: reason.trim(), locked_by: null, locked_at: null })
    .eq('id', periodId)
  if (error) return fail(friendly(error.message))
  await actor.supabase.from('payroll_slips').delete().eq('period_id', periodId)

  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_period',
    resourceId: periodId, resourceLabel: `Penggajian ${periodLabelOf(period)}`, branchId: period.branch_id,
    oldValues: { status: 'locked' }, newValues: { status: 'draft', unlock_reason: reason.trim() },
  })
  return ok(null)
}

/** Finance: mark paid, optionally recording the payout as a GAJI expense transaction. */
export async function markPayrollPaid(periodId: string, recordExpense: boolean): Promise<Result> {
  const actor = await getActor(PAID_ROLES)
  if (isErr(actor)) return actor
  const { supabase } = actor
  const period = await loadPeriod(supabase, periodId)
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.status !== 'locked') return fail('Periode harus dikunci sebelum dibayar.')

  let expenseId: string | null = null
  if (recordExpense) {
    const { data: slips } = await supabase.from('payroll_slips').select('net').eq('period_id', periodId)
    const total = (slips ?? []).reduce((s, x) => s + Number(x.net), 0)
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        branch_id: period.branch_id,
        type: 'expense',
        category: 'GAJI',
        amount: total,
        harga: total,
        description: `Gaji karyawan ${periodLabelOf(period)}`,
        status: 'confirmed',
        recorded_by: actor.userId,
        confirmed_by: actor.userId,
        transaction_date: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single()
    if (txnErr) return fail(`Gagal mencatat pengeluaran: ${txnErr.message}`)
    expenseId = txn?.id ?? null
  }

  const { error } = await supabase
    .from('payroll_periods')
    .update({ status: 'paid', paid_by: actor.userId, paid_at: new Date().toISOString(), expense_transaction_id: expenseId })
    .eq('id', periodId)
  if (error) return fail(friendly(error.message))

  logActivity({
    supabase, userId: actor.userId, action: 'update', resourceType: 'payroll_period',
    resourceId: periodId, resourceLabel: `Penggajian ${periodLabelOf(period)}`, branchId: period.branch_id,
    oldValues: { status: 'locked' }, newValues: { status: 'paid', expense_transaction_id: expenseId },
  })
  return ok(null)
}

// ── Payslips ────────────────────────────────────────────────────────────────

export async function getMyPayslips(): Promise<Result<{ slips: SlipRecord[]; headers: Record<string, WorkspaceSettings> }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Sesi berakhir, silakan login ulang.')
  const { data, error } = await supabase
    .from('payroll_slips')
    .select('*')
    .eq('staff_id', user.id)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
  if (error) return fail(error.message)
  const slips = ((data ?? []) as SlipRecord[]).map((s) => ({
    ...s, gross: Number(s.gross), total_deductions: Number(s.total_deductions), net: Number(s.net),
  }))
  // Staff can't read payroll_periods/settings; each slip's header comes from its
  // period's frozen snapshot, read with the service role and scoped to the
  // period ids of this user's own slips.
  const headers: Record<string, WorkspaceSettings> = {}
  const periodIds = [...new Set(slips.map((s) => s.period_id))]
  if (periodIds.length) {
    const { data: periods } = await createAdminClient()
      .from('payroll_periods')
      .select('id, settings_snapshot')
      .in('id', periodIds)
    for (const p of periods ?? []) {
      const snap = (p.settings_snapshot as { settings?: WorkspaceSettings } | null)?.settings
      if (snap) headers[p.id] = snap
    }
  }
  return ok({ slips, headers })
}
