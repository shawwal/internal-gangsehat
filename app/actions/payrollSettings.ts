'use server'

// Payroll admin panel: employee master (ID sheet), versioned compensation,
// deduction rules, holidays, activity catalogue and period settings.

import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import type { ActivityType, BonusTier, Compensation, DeductionRule, Weekday } from '@/lib/payroll/types'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }
type Result<T = null> = Ok<T> | Err
const ok = <T>(data: T): Ok<T> => ({ ok: true, data })
const fail = (error: string): Err => ({ ok: false, error })

const EDIT_ROLES = ['director', 'hr', 'manager']

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Sesi berakhir, silakan login ulang.')
  const { data: profile } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile || !EDIT_ROLES.includes(profile.role)) return fail('Anda tidak memiliki akses ke pengaturan penggajian.')
  return { supabase, userId: user.id, role: profile.role as string, branchId: profile.branch_id as string | null }
}
type Actor = Exclude<Awaited<ReturnType<typeof getActor>>, Err>
const isErr = (x: unknown): x is Err => typeof x === 'object' && x !== null && (x as Err).ok === false

function friendly(msg: string): string {
  if (msg.includes('employee_payroll_profiles_employee_no_key')) return 'No. karyawan sudah dipakai karyawan lain.'
  if (msg.includes('employee_compensation_staff_id_effective_from_key')) return 'Sudah ada versi kompensasi dengan tanggal berlaku yang sama.'
  if (msg.includes('uq_payroll_holidays')) return 'Tanggal libur ini sudah terdaftar.'
  if (msg.includes('uq_payroll_deduction_rules_code')) return 'Kode aturan sudah dipakai.'
  return msg
}

/** Director edits global rows (branchId null) or any branch; others only their own branch. */
function assertBranchScope(actor: Actor, branchId: string | null): Err | null {
  if (actor.role === 'director') return null
  if (!branchId || branchId !== actor.branchId) return fail('Anda hanya dapat mengubah pengaturan cabang sendiri.')
  return null
}

// ── Read ────────────────────────────────────────────────────────────────────

export interface EmployeeRow {
  id: string
  full_name: string
  nickname: string | null
  role: string
  is_active: boolean
  employee_no: string | null
  jabatan: string | null
  hire_date: string | null
  termination_date: string | null
  include_in_payroll: boolean
  versions: (Compensation & { id: string; effective_from: string; notes: string | null; created_at: string })[]
}

export interface PayrollSettingsData {
  role: string
  branches: { id: string; name: string }[]
  branchId: string
  settings: {
    id: string | null
    scope: 'branch' | 'global' | 'default'
    period_start_day: number
    weekly_off_days: Weekday[]
    rounding_unit: number
    max_late_days_warning: number
    clinic_name: string
    clinic_address: string
    clinic_contact: string
  }
  deductionRules: (DeductionRule & { id: string; branch_id: string | null })[]
  holidays: { id: string; date: string; name: string; branch_id: string | null }[]
  activityTypes: ActivityType[]
  employees: EmployeeRow[]
  layanan: { id: string; nama: string; kategori: string }[]
}

export async function getPayrollSettingsData(branchIdParam?: string | null): Promise<Result<PayrollSettingsData>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const { supabase } = actor

  let bq = supabase.from('branches').select('id, name').eq('is_active', true).order('name')
  if (actor.role !== 'director') bq = bq.eq('id', actor.branchId ?? '')
  const { data: branches } = await bq
  const branchId = branchIdParam && (actor.role === 'director' || branchIdParam === actor.branchId)
    ? branchIdParam
    : (actor.branchId ?? branches?.[0]?.id ?? '')
  if (!branchId) return fail('Belum ada cabang.')

  const [settingsRes, rulesRes, holidaysRes, typesRes, staffRes, layananRes] = await Promise.all([
    supabase.from('payroll_settings').select('*').or(`branch_id.eq.${branchId},branch_id.is.null`),
    supabase.from('payroll_deduction_rules').select('*').or(`branch_id.eq.${branchId},branch_id.is.null`).order('sort_order'),
    supabase.from('payroll_holidays').select('id, date, name, branch_id').or(`branch_id.eq.${branchId},branch_id.is.null`)
      .order('date', { ascending: false }).limit(200),
    supabase.from('payroll_activity_types').select('*').order('sort_order'),
    supabase.from('internal_profiles').select('id, full_name, nickname, role, is_active').eq('branch_id', branchId)
      .neq('role', 'non-staff').order('full_name'),
    supabase.from('internal_layanan').select('id, nama, kategori').eq('is_active', true).order('kategori').order('nama'),
  ])

  const staff = staffRes.data ?? []
  const ids = staff.map((s) => s.id)
  const [ppRes, compRes] = ids.length
    ? await Promise.all([
        supabase.from('employee_payroll_profiles').select('*').in('staff_id', ids),
        supabase.from('employee_compensation').select('*').in('staff_id', ids).order('effective_from', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]
  const ppBy = new Map(((ppRes.data ?? []) as Record<string, unknown>[]).map((p) => [p.staff_id as string, p]))
  const compBy = new Map<string, EmployeeRow['versions']>()
  for (const c of (compRes.data ?? []) as Record<string, unknown>[]) {
    const id = c.staff_id as string
    compBy.set(id, [...(compBy.get(id) ?? []), {
      id: c.id as string,
      effective_from: c.effective_from as string,
      notes: (c.notes as string) ?? null,
      created_at: c.created_at as string,
      gaji_pokok: Number(c.gaji_pokok), tj_jabatan: Number(c.tj_jabatan), operasional: Number(c.operasional),
      operasional_mode: c.operasional_mode as Compensation['operasional_mode'],
      operasional_threshold: Number(c.operasional_threshold), operasional_daily_rate: Number(c.operasional_daily_rate),
      insentif_base: Number(c.insentif_base), incentive_target: Number(c.incentive_target),
      incentive_activity_codes: (c.incentive_activity_codes as string[]) ?? [],
      bonus_tiers: (c.bonus_tiers as BonusTier[]) ?? [],
      activity_rates: (c.activity_rates as Record<string, number>) ?? {},
    }])
  }

  const settingsRows = (settingsRes.data ?? []) as Record<string, unknown>[]
  const own = settingsRows.find((r) => r.branch_id === branchId)
  const global = settingsRows.find((r) => r.branch_id === null)
  const s = own ?? global

  return ok({
    role: actor.role,
    branches: branches ?? [],
    branchId,
    settings: {
      id: (own?.id as string) ?? null,
      scope: own ? 'branch' : global ? 'global' : 'default',
      period_start_day: Number(s?.period_start_day ?? 27),
      weekly_off_days: ((s?.weekly_off_days as Weekday[]) ?? ['JUMAT']),
      rounding_unit: Number(s?.rounding_unit ?? 1000),
      max_late_days_warning: Number(s?.max_late_days_warning ?? 4),
      clinic_name: (s?.clinic_name as string) ?? '',
      clinic_address: (s?.clinic_address as string) ?? '',
      clinic_contact: (s?.clinic_contact as string) ?? '',
    },
    deductionRules: ((rulesRes.data ?? []) as (DeductionRule & { id: string; branch_id: string | null })[])
      .map((r) => ({ ...r, amount: Number(r.amount) })),
    holidays: (holidaysRes.data ?? []) as PayrollSettingsData['holidays'],
    activityTypes: (typesRes.data ?? []) as ActivityType[],
    employees: staff.map((st) => {
      const pp = ppBy.get(st.id)
      return {
        id: st.id,
        full_name: st.full_name,
        nickname: st.nickname,
        role: st.role,
        is_active: st.is_active,
        employee_no: (pp?.employee_no as string) ?? null,
        jabatan: (pp?.jabatan as string) ?? null,
        hire_date: (pp?.hire_date as string) ?? null,
        termination_date: (pp?.termination_date as string) ?? null,
        include_in_payroll: (pp?.include_in_payroll as boolean) ?? true,
        versions: compBy.get(st.id) ?? [],
      }
    }),
    layanan: (layananRes.data ?? []) as PayrollSettingsData['layanan'],
  })
}

// ── Period settings ─────────────────────────────────────────────────────────

export async function savePayrollSettings(branchId: string | null, input: {
  period_start_day: number
  weekly_off_days: Weekday[]
  rounding_unit: number
  max_late_days_warning: number
  clinic_name: string
  clinic_address: string
  clinic_contact: string
}): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const scopeErr = assertBranchScope(actor, branchId)
  if (scopeErr) return scopeErr
  if (!Number.isInteger(input.period_start_day) || input.period_start_day < 1 || input.period_start_day > 31) {
    return fail('Tanggal mulai periode harus 1–31.')
  }
  if (!Number.isInteger(input.rounding_unit) || input.rounding_unit < 1) return fail('Satuan pembulatan tidak valid.')

  const { supabase } = actor
  let q = supabase.from('payroll_settings').select('*')
  q = branchId ? q.eq('branch_id', branchId) : q.is('branch_id', null)
  const { data: existing } = await q.maybeSingle()
  const row = { ...input, branch_id: branchId, updated_by: actor.userId }
  const { error } = existing
    ? await supabase.from('payroll_settings').update(row).eq('id', existing.id)
    : await supabase.from('payroll_settings').insert(row)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase, userId: actor.userId, action: existing ? 'update' : 'create', resourceType: 'payroll_setting',
    resourceId: existing?.id ?? null, resourceLabel: 'Pengaturan periode & slip', branchId,
    oldValues: existing ?? null, newValues: row,
  })
  return ok(null)
}

// ── Deduction rules ─────────────────────────────────────────────────────────

export async function saveDeductionRule(input: {
  id?: string
  branch_id: string | null
  code: string
  label: string
  basis: DeductionRule['basis']
  calc_type: DeductionRule['calc_type']
  amount: number
  is_active: boolean
  sort_order: number
}): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const scopeErr = assertBranchScope(actor, input.branch_id)
  if (scopeErr) return scopeErr
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  if (!code || !input.label.trim()) return fail('Kode dan label wajib diisi.')
  if (!Number.isFinite(input.amount) || input.amount < 0) return fail('Nominal tidak valid.')
  if (input.calc_type === 'percent_base' && input.amount > 100) return fail('Persentase maksimal 100%.')

  const { supabase } = actor
  const row = {
    branch_id: input.branch_id, code, label: input.label.trim(), basis: input.basis, calc_type: input.calc_type,
    amount: input.amount, is_active: input.is_active, sort_order: input.sort_order, updated_by: actor.userId,
  }
  const before = input.id ? (await supabase.from('payroll_deduction_rules').select('*').eq('id', input.id).maybeSingle()).data : null
  const { error } = input.id
    ? await supabase.from('payroll_deduction_rules').update(row).eq('id', input.id)
    : await supabase.from('payroll_deduction_rules').insert(row)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase, userId: actor.userId, action: input.id ? 'update' : 'create', resourceType: 'payroll_setting',
    resourceId: input.id ?? null, resourceLabel: `Aturan potongan ${code}`, branchId: input.branch_id,
    oldValues: before, newValues: row,
  })
  return ok(null)
}

export async function deleteDeductionRule(id: string): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const { data: before } = await actor.supabase.from('payroll_deduction_rules').select('*').eq('id', id).maybeSingle()
  if (!before) return fail('Aturan tidak ditemukan.')
  const scopeErr = assertBranchScope(actor, before.branch_id)
  if (scopeErr) return scopeErr
  const { error } = await actor.supabase.from('payroll_deduction_rules').delete().eq('id', id)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'delete', resourceType: 'payroll_setting',
    resourceId: id, resourceLabel: `Aturan potongan ${before.code}`, branchId: before.branch_id, oldValues: before,
  })
  return ok(null)
}

// ── Holidays ────────────────────────────────────────────────────────────────

export async function addPayrollHoliday(branchId: string | null, date: string, name: string): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const scopeErr = assertBranchScope(actor, branchId)
  if (scopeErr) return scopeErr
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name.trim()) return fail('Tanggal dan nama libur wajib diisi.')
  const row = { branch_id: branchId, date, name: name.trim(), created_by: actor.userId }
  const { error } = await actor.supabase.from('payroll_holidays').insert(row)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'create', resourceType: 'payroll_setting',
    resourceLabel: `Hari libur ${date}`, branchId, newValues: row,
  })
  return ok(null)
}

export async function deletePayrollHoliday(id: string): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const { data: before } = await actor.supabase.from('payroll_holidays').select('*').eq('id', id).maybeSingle()
  if (!before) return fail('Hari libur tidak ditemukan.')
  const scopeErr = assertBranchScope(actor, before.branch_id)
  if (scopeErr) return scopeErr
  const { error } = await actor.supabase.from('payroll_holidays').delete().eq('id', id)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'delete', resourceType: 'payroll_setting',
    resourceId: id, resourceLabel: `Hari libur ${before.date}`, branchId: before.branch_id, oldValues: before,
  })
  return ok(null)
}

// ── Activity catalogue (director) ───────────────────────────────────────────

export async function saveActivityType(input: Omit<ActivityType, 'sort_order'> & { sort_order?: number; isNew?: boolean }): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (actor.role !== 'director') return fail('Hanya direktur yang dapat mengubah katalog aktivitas.')
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  if (!code || !input.label.trim()) return fail('Kode dan label wajib diisi.')
  if (!Number.isInteger(input.max_per_period) || input.max_per_period < 1) return fail('Batas wajar harus ≥ 1.')
  if (input.count_mode !== 'manual' && input.source_service_types.length === 0) {
    return fail('Pilih minimal satu jenis layanan sumber untuk mode otomatis.')
  }
  const row = {
    code, label: input.label.trim(), group_label: input.group_label.trim() || 'Lainnya', count_mode: input.count_mode,
    source_service_types: input.source_service_types, source_layanan_ids: input.source_layanan_ids,
    max_per_period: input.max_per_period, is_active: input.is_active, sort_order: input.sort_order ?? 100,
  }
  const { supabase } = actor
  const before = input.isNew ? null : (await supabase.from('payroll_activity_types').select('*').eq('code', code).maybeSingle()).data
  const { error } = input.isNew
    ? await supabase.from('payroll_activity_types').insert(row)
    : await supabase.from('payroll_activity_types').update(row).eq('code', code)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase, userId: actor.userId, action: input.isNew ? 'create' : 'update', resourceType: 'payroll_setting',
    resourceId: code, resourceLabel: `Aktivitas ${code}`, oldValues: before, newValues: row,
  })
  return ok(null)
}

// ── Employees & compensation ────────────────────────────────────────────────

async function assertStaffInScope(actor: Actor, staffId: string): Promise<Err | null> {
  if (actor.role === 'director') return null
  const { data } = await actor.supabase.from('internal_profiles').select('branch_id').eq('id', staffId).maybeSingle()
  if (!data || data.branch_id !== actor.branchId) return fail('Karyawan bukan dari cabang Anda.')
  return null
}

export async function saveEmployeePayrollProfile(staffId: string, input: {
  employee_no: string | null
  jabatan: string | null
  hire_date: string | null
  termination_date: string | null
  include_in_payroll: boolean
}): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const scopeErr = await assertStaffInScope(actor, staffId)
  if (scopeErr) return scopeErr
  const employeeNo = input.employee_no?.trim().toUpperCase() || null
  if (employeeNo && !/^[A-Z0-9.\-/]{3,20}$/.test(employeeNo)) return fail('Format no. karyawan tidak valid.')

  const { supabase } = actor
  const { data: before } = await supabase.from('employee_payroll_profiles').select('*').eq('staff_id', staffId).maybeSingle()
  const row = {
    staff_id: staffId,
    employee_no: employeeNo,
    jabatan: input.jabatan?.trim().toUpperCase() || null,
    hire_date: input.hire_date || null,
    termination_date: input.termination_date || null,
    include_in_payroll: input.include_in_payroll,
    updated_by: actor.userId,
  }
  const { error } = await supabase.from('employee_payroll_profiles').upsert(row, { onConflict: 'staff_id' })
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase, userId: actor.userId, action: before ? 'update' : 'create', resourceType: 'payroll_employee',
    resourceId: staffId, resourceLabel: employeeNo, oldValues: before, newValues: row,
  })
  return ok(null)
}

function validateCompensation(c: Compensation): string | null {
  const money = [c.gaji_pokok, c.tj_jabatan, c.operasional, c.insentif_base, c.operasional_daily_rate]
  if (money.some((n) => !Number.isFinite(n) || n < 0 || n > 1_000_000_000)) return 'Nominal kompensasi tidak valid.'
  if (c.operasional_threshold < 0 || c.operasional_threshold > 1) return 'Batas kehadiran operasional harus 0–100%.'
  if (!Number.isInteger(c.incentive_target) || c.incentive_target < 0) return 'Target insentif harus bilangan bulat ≥ 0.'
  for (const t of c.bonus_tiers) {
    if (!(t.min_qty > 0) || !(t.amount >= 0)) return 'Tingkat bonus tidak valid.'
  }
  for (const v of Object.values(c.activity_rates)) {
    if (!Number.isFinite(v) || v < 0) return 'Tarif aktivitas tidak valid.'
  }
  return null
}

/** Adds a new compensation version. History rows are never edited (DB-enforced). */
export async function addCompensationVersion(staffId: string, effectiveFrom: string, comp: Compensation, notes: string | null): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const scopeErr = await assertStaffInScope(actor, staffId)
  if (scopeErr) return scopeErr
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return fail('Tanggal berlaku wajib diisi.')
  const invalid = validateCompensation(comp)
  if (invalid) return fail(invalid)

  const activityRates = Object.fromEntries(Object.entries(comp.activity_rates).filter(([, v]) => v > 0))
  const row = {
    staff_id: staffId,
    effective_from: effectiveFrom,
    gaji_pokok: comp.gaji_pokok,
    tj_jabatan: comp.tj_jabatan,
    operasional: comp.operasional,
    operasional_mode: comp.operasional_mode,
    operasional_threshold: comp.operasional_threshold,
    operasional_daily_rate: comp.operasional_daily_rate,
    insentif_base: comp.insentif_base,
    incentive_target: comp.incentive_target,
    incentive_activity_codes: comp.incentive_activity_codes,
    bonus_tiers: comp.bonus_tiers.filter((t) => t.amount > 0),
    activity_rates: activityRates,
    notes: notes?.trim() || null,
    created_by: actor.userId,
  }
  const { data, error } = await actor.supabase.from('employee_compensation').insert(row).select('id').single()
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'create', resourceType: 'payroll_compensation',
    resourceId: data?.id ?? null, resourceLabel: `Kompensasi berlaku ${effectiveFrom}`, newValues: row,
  })
  return ok(null)
}

/** Remove a version created by mistake — only while no locked slip used it. */
export async function deleteCompensationVersion(id: string): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const { supabase } = actor
  const { data: version } = await supabase.from('employee_compensation').select('*').eq('id', id).maybeSingle()
  if (!version) return fail('Versi tidak ditemukan.')
  const scopeErr = await assertStaffInScope(actor, version.staff_id)
  if (scopeErr) return scopeErr
  const { count } = await supabase
    .from('payroll_slips')
    .select('id', { count: 'exact', head: true })
    .eq('staff_id', version.staff_id)
    .gte('end_date', version.effective_from)
  if ((count ?? 0) > 0) return fail('Versi ini sudah dipakai di slip gaji yang dikunci — tambahkan versi baru sebagai koreksi.')
  const { error } = await supabase.from('employee_compensation').delete().eq('id', id)
  if (error) return fail(friendly(error.message))
  logActivity({
    supabase, userId: actor.userId, action: 'delete', resourceType: 'payroll_compensation',
    resourceId: id, resourceLabel: `Kompensasi berlaku ${version.effective_from}`, oldValues: version,
  })
  return ok(null)
}
