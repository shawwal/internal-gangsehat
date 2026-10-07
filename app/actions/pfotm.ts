'use server'

// PFOTM (Powerful Fisioterapis of the Month) server actions. RLS
// (096-pfotm-leaderboard.sql) scopes reads to the caller's branch and blocks
// edits to locked periods for everyone but the director.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activityLog'
import { buildPeriodDays, MONTH_NAMES } from '@/lib/payroll/period'
import { VISIT_FOR_PAYROLL_COLUMNS, type VisitForPayroll } from '@/lib/payroll/autoActivity'
import type { Weekday } from '@/lib/payroll/types'
import {
  computePfotmAutoMetrics, CLINIC_VISIT_TYPES, SALES_CATEGORIES, SALES_PAYMENT_STATUSES,
  type AttendanceForPfotm, type PackageInfo, type SaleForPfotm,
} from '@/lib/pfotm/autoMetrics'
import { mergeMetrics, rankBoard, sanitizeMetricValue, type Metrics, type PointRule } from '@/lib/pfotm/engine'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }
type Result<T = null> = Ok<T> | Err
const ok = <T>(data: T): Ok<T> => ({ ok: true, data })
const fail = (error: string): Err => ({ ok: false, error })

const INPUT_ROLES = ['director', 'hr', 'manager', 'admin']
const RULE_ROLES = ['director', 'hr', 'manager']
/** Roles enrolled automatically when a period opens. */
const PARTICIPANT_ROLES = ['therapist']

type ServerClient = Awaited<ReturnType<typeof createClient>>

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Sesi berakhir, silakan login ulang.')
  const { data: profile } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile) return fail('Profil tidak ditemukan.')
  return { supabase, userId: user.id, role: profile.role as string, branchId: profile.branch_id as string | null }
}
const isErr = (x: unknown): x is Err => typeof x === 'object' && x !== null && (x as Err).ok === false

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

// ── Types returned to the UI ────────────────────────────────────────────────

export interface PfotmEntry {
  id: string
  staff_id: string | null
  display_name: string
  avatar_url: string | null
  auto_metrics: Metrics
  override_metrics: Metrics
  excluded: boolean
  // frozen at lock
  metrics: Metrics | null
  total_points: number | null
  rank: number | null
}

export interface PfotmPeriod {
  id: string
  branch_id: string
  period_year: number
  period_month: number
  start_date: string
  end_date: string
  working_days: number
  working_days_override: boolean
  is_locked: boolean
  locked_at: string | null
  rules_snapshot: PointRule[] | null
}

export interface PfotmBoardData {
  role: string
  branches: { id: string; name: string }[]
  branchId: string
  period: PfotmPeriod | null
  rules: PointRule[]          // snapshot for locked periods, live rules otherwise
  liveRules: PointRule[]
  entries: PfotmEntry[]
  /** champion count per staff id / display name across locked periods of this branch */
  wins: Record<string, number>
  permissions: { canInput: boolean; canLock: boolean; canUnlock: boolean; canEditRules: boolean }
}

// ── Loaders ─────────────────────────────────────────────────────────────────

async function loadRules(supabase: ServerClient): Promise<PointRule[]> {
  const { data } = await supabase
    .from('pfotm_point_rules')
    .select('metric_key, metric_label, weight, is_penalty, source, sort_order, is_active')
    .order('sort_order')
  return ((data ?? []) as PointRule[]).map((r) => ({ ...r, weight: Number(r.weight) }))
}

async function loadWorkingWindow(supabase: ServerClient, branchId: string, year: number, month: number) {
  // Same window as payroll (27 → 26 by default) so Hadir/Terlambat match the ABS data.
  const { data: payroll } = await supabase
    .from('payroll_periods')
    .select('start_date, end_date, workdays')
    .eq('branch_id', branchId).eq('period_year', year).eq('period_month', month)
    .maybeSingle()
  if (payroll) return { start: payroll.start_date as string, end: payroll.end_date as string, workdays: payroll.workdays as number }

  const { data: settingsRows } = await supabase
    .from('payroll_settings')
    .select('branch_id, period_start_day, weekly_off_days')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
  const s = (settingsRows ?? []).find((r) => r.branch_id === branchId) ?? (settingsRows ?? []).find((r) => r.branch_id === null)
  const startDay = s?.period_start_day ?? 27
  const probe = buildPeriodDays(year, month, { startDay, weeklyOffDays: [], holidays: [] })
  const { data: holidays } = await supabase
    .from('payroll_holidays')
    .select('date, name')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
    .gte('date', probe.start).lte('date', probe.end)
  const built = buildPeriodDays(year, month, {
    startDay, weeklyOffDays: (s?.weekly_off_days ?? ['JUMAT']) as Weekday[], holidays: holidays ?? [],
  })
  return { start: built.start, end: built.end, workdays: built.workdays }
}

async function collectAutoMetrics(supabase: ServerClient, branchId: string, staffIds: string[], start: string, end: string) {
  if (!staffIds.length) return {}
  const today = todayJakarta()
  // `transactions` is RLS-limited to finance-capable roles, but HR prepares
  // PFOTM too — callers have already checked INPUT_ROLES, so the sales read
  // uses the service role, scoped to this branch and period.
  const admin = createAdminClient()
  const [attRes, visitRes, refRes, txRes] = await Promise.all([
    supabase.from('attendance').select('staff_id, status').in('staff_id', staffIds).gte('date', start).lte('date', end),
    supabase.from('patient_visits')
      .select(VISIT_FOR_PAYROLL_COLUMNS)
      .in('attending_staff_id', staffIds)
      .in('service_type', CLINIC_VISIT_TYPES)
      .eq('status', 'completed')
      .gte('visit_date', start).lte('visit_date', end)
      .limit(20000),
    supabase.from('patients').select('id, referred_by_staff_id, created_at').in('referred_by_staff_id', staffIds),
    admin.from('transactions')
      .select('id, fisio_id, visit_id, order_id, category')
      .eq('branch_id', branchId)
      .eq('type', 'income')
      .neq('status', 'rejected')
      .in('payment_status', SALES_PAYMENT_STATUSES)
      .in('category', SALES_CATEGORIES)
      .gte('transaction_date', start).lte('transaction_date', end)
      .limit(20000),
  ])
  const periodVisits = (visitRes.data ?? []) as unknown as VisitForPayroll[]
  const txRows = (txRes.data ?? []) as { id: string; fisio_id: string | null; visit_id: string | null; order_id: string | null; category: string }[]

  // Attribute each sale: the transaction's Fisio, else the linked visit's
  // therapist. PAKET KLINIK also needs its package (by order_id or via the
  // linked visit) to tell P1 / P2 / P3 apart.
  const visitIds = [...new Set(txRows.map((t) => t.visit_id).filter((x): x is string => !!x))]
  const orderIds = [...new Set(txRows.map((t) => t.order_id).filter((x): x is string => !!x))]
  const visitById = new Map<string, { attending_staff_id: string | null; package_id: string | null }>()
  const packageById = new Map<string, PackageInfo>()
  const packageByOrder = new Map<string, PackageInfo>()
  for (let i = 0; i < visitIds.length; i += 300) {
    const { data } = await admin.from('patient_visits').select('id, attending_staff_id, package_id').in('id', visitIds.slice(i, i + 300))
    for (const v of data ?? []) visitById.set(v.id, v)
  }
  const pkgIds = [...new Set([...visitById.values()].map((v) => v.package_id).filter((x): x is string => !!x))]
  for (let i = 0; i < pkgIds.length; i += 300) {
    const { data } = await admin.from('patient_packages').select('id, jenis_paket, total_sessions').in('id', pkgIds.slice(i, i + 300))
    for (const p of (data ?? []) as PackageInfo[]) packageById.set(p.id, p)
  }
  for (let i = 0; i < orderIds.length; i += 300) {
    const { data } = await admin.from('patient_packages').select('id, jenis_paket, total_sessions, order_id').in('order_id', orderIds.slice(i, i + 300))
    for (const p of (data ?? []) as (PackageInfo & { order_id: string })[]) packageByOrder.set(p.order_id, p)
  }
  const sales: SaleForPfotm[] = txRows.map((t) => {
    const visit = t.visit_id ? visitById.get(t.visit_id) : undefined
    const pkg = (t.order_id ? packageByOrder.get(t.order_id) : undefined)
      ?? (visit?.package_id ? packageById.get(visit.package_id) : undefined)
      ?? null
    return { staff_id: t.fisio_id ?? visit?.attending_staff_id ?? null, category: t.category, package: pkg }
  })

  // Referral date = the referred patient's first visit (fallback: registration date).
  const referred = (refRes.data ?? []) as { id: string; referred_by_staff_id: string; created_at: string }[]
  const firstVisitByPatient = new Map<string, string>()
  for (let i = 0; i < referred.length; i += 300) {
    const { data: fv } = await supabase
      .from('patient_visits').select('patient_id, visit_date')
      .in('patient_id', referred.slice(i, i + 300).map((r) => r.id))
      .order('visit_date', { ascending: true })
    for (const v of fv ?? []) if (!firstVisitByPatient.has(v.patient_id)) firstVisitByPatient.set(v.patient_id, v.visit_date)
  }
  const referrals = referred.map((r) => ({
    staff_id: r.referred_by_staff_id,
    first_date: firstVisitByPatient.get(r.id) ?? r.created_at.slice(0, 10),
  }))

  return computePfotmAutoMetrics({
    staffIds, start, end, todayISO: today,
    attendance: (attRes.data ?? []) as AttendanceForPfotm[],
    periodVisits, sales, referrals,
  })
}

// ── Board ───────────────────────────────────────────────────────────────────

export async function getPfotmBoard(branchIdParam: string | null, year: number, month: number): Promise<Result<PfotmBoardData>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const { supabase } = actor

  let bq = supabase.from('branches').select('id, name').eq('is_active', true).order('name')
  if (actor.role !== 'director') bq = bq.eq('id', actor.branchId ?? '')
  const { data: branches } = await bq
  const branchId = actor.role === 'director' ? (branchIdParam || branches?.[0]?.id || '') : (actor.branchId ?? '')
  if (!branchId) return fail('Akun Anda belum terhubung ke cabang.')

  const [{ data: period }, liveRules, { data: lockedPeriods }] = await Promise.all([
    supabase.from('pfotm_periods').select('*').eq('branch_id', branchId).eq('period_year', year).eq('period_month', month).maybeSingle(),
    loadRules(supabase),
    supabase.from('pfotm_periods').select('id').eq('branch_id', branchId).eq('is_locked', true),
  ])

  let entries: PfotmEntry[] = []
  if (period) {
    const { data: rows } = await supabase
      .from('pfotm_entries')
      .select('id, staff_id, display_name, auto_metrics, override_metrics, excluded, metrics, total_points, rank, internal_profiles!staff_id(avatar_url)')
      .eq('period_id', period.id)
    entries = ((rows ?? []) as unknown as (Omit<PfotmEntry, 'avatar_url'> & { internal_profiles: { avatar_url: string | null } | null })[])
      .map(({ internal_profiles, ...e }) => ({ ...e, avatar_url: internal_profiles?.avatar_url ?? null, total_points: e.total_points === null ? null : Number(e.total_points) }))
  }

  // Badge counter: months won (rank 1) in locked periods of this branch.
  const wins: Record<string, number> = {}
  const lockedIds = (lockedPeriods ?? []).map((p) => p.id)
  if (lockedIds.length) {
    const { data: champs } = await supabase.from('pfotm_entries').select('staff_id, display_name').in('period_id', lockedIds).eq('rank', 1)
    for (const c of champs ?? []) {
      const k = c.staff_id ?? c.display_name
      wins[k] = (wins[k] ?? 0) + 1
    }
  }

  const p = period as PfotmPeriod | null
  return ok({
    role: actor.role,
    branches: branches ?? [],
    branchId,
    period: p,
    rules: p?.is_locked && p.rules_snapshot ? p.rules_snapshot : liveRules,
    liveRules,
    entries,
    wins,
    permissions: {
      canInput: INPUT_ROLES.includes(actor.role) && (!p?.is_locked || actor.role === 'director'),
      canLock: INPUT_ROLES.includes(actor.role),
      canUnlock: actor.role === 'director',
      canEditRules: RULE_ROLES.includes(actor.role),
    },
  })
}

// ── Period lifecycle ────────────────────────────────────────────────────────

export async function openPfotmPeriod(branchId: string, year: number, month: number): Promise<Result<string>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!INPUT_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses.')
  if (actor.role !== 'director' && branchId !== actor.branchId) return fail('Anda tidak memiliki akses.')
  const { supabase } = actor

  const win = await loadWorkingWindow(supabase, branchId, year, month)
  const { data: period, error } = await supabase
    .from('pfotm_periods')
    .insert({ branch_id: branchId, period_year: year, period_month: month, start_date: win.start, end_date: win.end, working_days: win.workdays, created_by: actor.userId })
    .select('id')
    .single()
  if (error || !period) return fail(error?.message.includes('pfotm_periods_branch_id') ? 'Periode ini sudah ada.' : (error?.message ?? 'Gagal membuat periode.'))

  const { data: staff } = await supabase
    .from('internal_profiles')
    .select('id, full_name, nickname, role')
    .eq('branch_id', branchId).eq('is_active', true).in('role', PARTICIPANT_ROLES)
  const staffList = staff ?? []
  const auto = await collectAutoMetrics(supabase, branchId, staffList.map((s) => s.id), win.start, win.end)
  if (staffList.length) {
    await supabase.from('pfotm_entries').insert(staffList.map((s) => ({
      period_id: period.id,
      staff_id: s.id,
      display_name: (s.nickname?.trim() || s.full_name).toUpperCase(),
      auto_metrics: auto[s.id] ?? {},
      updated_by: actor.userId,
    })))
  }
  logActivity({
    supabase, userId: actor.userId, action: 'create', resourceType: 'pfotm_period', resourceId: period.id,
    resourceLabel: `PFOTM ${MONTH_NAMES[month - 1]} ${year}`, branchId,
    newValues: { start: win.start, end: win.end, working_days: win.workdays, participants: staffList.length },
  })
  return ok(period.id)
}

export async function refreshPfotmAuto(periodId: string): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!INPUT_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses.')
  const { supabase } = actor
  const { data: period } = await supabase.from('pfotm_periods').select('*').eq('id', periodId).maybeSingle()
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.is_locked) return fail('Periode sudah dikunci.')

  const { data: entries } = await supabase.from('pfotm_entries').select('id, staff_id').eq('period_id', periodId)
  const staffIds = (entries ?? []).map((e) => e.staff_id).filter((x): x is string => !!x)
  const auto = await collectAutoMetrics(supabase, period.branch_id, staffIds, period.start_date, period.end_date)
  for (const e of entries ?? []) {
    if (!e.staff_id) continue
    await supabase.from('pfotm_entries').update({ auto_metrics: auto[e.staff_id] ?? {}, updated_by: actor.userId }).eq('id', e.id)
  }

  // Keep working days in sync with payroll unless HR overrode them.
  if (!period.working_days_override) {
    const win = await loadWorkingWindow(supabase, period.branch_id, period.period_year, period.period_month)
    await supabase.from('pfotm_periods').update({ working_days: win.workdays }).eq('id', periodId)
  }
  return ok(null)
}

export async function setPfotmOverride(entryId: string, metricKey: string, raw: number | null): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!INPUT_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses.')
  const value = raw === null ? null : sanitizeMetricValue(raw)
  if (raw !== null && value === null) return fail('Nilai harus bilangan bulat ≥ 0.')
  if (value !== null && value > 10000) return fail('Nilai terlalu besar.')
  const { supabase } = actor

  const { data: entry } = await supabase
    .from('pfotm_entries')
    .select('id, display_name, override_metrics, period_id, pfotm_periods!period_id(is_locked, branch_id)')
    .eq('id', entryId).maybeSingle()
  if (!entry) return fail('Data tidak ditemukan.')
  const per = entry.pfotm_periods as unknown as { is_locked: boolean; branch_id: string } | null
  if (per?.is_locked && actor.role !== 'director') return fail('Periode sudah dikunci — perubahan memerlukan override direktur.')

  const before = (entry.override_metrics ?? {}) as Metrics
  const next: Metrics = { ...before }
  if (value === null) delete next[metricKey]
  else next[metricKey] = value
  const { error } = await supabase.from('pfotm_entries').update({ override_metrics: next, updated_by: actor.userId }).eq('id', entryId)
  if (error) return fail(error.message)

  // A locked-period edit only changes the override; re-freeze so the archive
  // stays consistent, and record that it was a super-admin override.
  if (per?.is_locked) await freezePeriod(supabase, entry.period_id, actor.userId, true)

  logActivity({
    supabase, userId: actor.userId, action: 'update', resourceType: 'pfotm_entry', resourceId: entryId,
    resourceLabel: `${entry.display_name} · ${metricKey}${per?.is_locked ? ' (override periode terkunci)' : ''}`,
    branchId: per?.branch_id ?? null, oldValues: { [metricKey]: before[metricKey] ?? null }, newValues: { [metricKey]: value },
  })
  return ok(null)
}

export async function setPfotmExcluded(entryId: string, excluded: boolean): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!INPUT_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses.')
  const { error } = await actor.supabase.from('pfotm_entries').update({ excluded, updated_by: actor.userId }).eq('id', entryId)
  if (error) return fail(error.message)
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'update', resourceType: 'pfotm_entry', resourceId: entryId,
    resourceLabel: excluded ? 'Dikeluarkan dari peringkat' : 'Diikutkan kembali', newValues: { excluded },
  })
  return ok(null)
}

export async function listPfotmCandidates(periodId: string): Promise<Result<{ id: string; full_name: string }[]>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const { data: period } = await actor.supabase.from('pfotm_periods').select('branch_id').eq('id', periodId).maybeSingle()
  if (!period) return fail('Periode tidak ditemukan.')
  const [{ data: staff }, { data: entries }] = await Promise.all([
    actor.supabase.from('internal_profiles').select('id, full_name, role').eq('branch_id', period.branch_id).eq('is_active', true).order('full_name'),
    actor.supabase.from('pfotm_entries').select('staff_id').eq('period_id', periodId),
  ])
  const taken = new Set((entries ?? []).map((e) => e.staff_id))
  return ok((staff ?? []).filter((s) => !taken.has(s.id) && !['director', 'non-staff'].includes(s.role)).map((s) => ({ id: s.id, full_name: s.full_name })))
}

export async function addPfotmParticipant(periodId: string, staffId: string): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!INPUT_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses.')
  const { supabase } = actor
  const [{ data: period }, { data: staff }] = await Promise.all([
    supabase.from('pfotm_periods').select('*').eq('id', periodId).maybeSingle(),
    supabase.from('internal_profiles').select('id, full_name, nickname').eq('id', staffId).maybeSingle(),
  ])
  if (!period || !staff) return fail('Data tidak ditemukan.')
  const auto = await collectAutoMetrics(supabase, period.branch_id, [staffId], period.start_date, period.end_date)
  const { error } = await supabase.from('pfotm_entries').insert({
    period_id: periodId, staff_id: staffId, display_name: (staff.nickname?.trim() || staff.full_name).toUpperCase(),
    auto_metrics: auto[staffId] ?? {}, updated_by: actor.userId,
  })
  if (error) return fail(error.message)
  return ok(null)
}

export async function setPfotmWorkingDays(periodId: string, days: number | null): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!INPUT_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses.')
  const { supabase } = actor
  const { data: period } = await supabase.from('pfotm_periods').select('*').eq('id', periodId).maybeSingle()
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.is_locked) return fail('Periode sudah dikunci.')
  let workingDays = days
  if (days === null) {
    workingDays = (await loadWorkingWindow(supabase, period.branch_id, period.period_year, period.period_month)).workdays
  } else if (!Number.isInteger(days) || days < 0 || days > 31) {
    return fail('Hari kerja harus 0–31.')
  }
  const { error } = await supabase.from('pfotm_periods')
    .update({ working_days: workingDays, working_days_override: days !== null }).eq('id', periodId)
  if (error) return fail(error.message)
  logActivity({
    supabase, userId: actor.userId, action: 'update', resourceType: 'pfotm_period', resourceId: periodId,
    resourceLabel: 'Hari kerja', branchId: period.branch_id,
    oldValues: { working_days: period.working_days }, newValues: { working_days: workingDays, override: days !== null },
  })
  return ok(null)
}

/** Writes metrics/points/rank/KPIs into every entry and the rules snapshot. */
async function freezePeriod(supabase: ServerClient, periodId: string, userId: string, keepSnapshot: boolean) {
  const { data: period } = await supabase.from('pfotm_periods').select('*').eq('id', periodId).single()
  const rules: PointRule[] = keepSnapshot && period?.rules_snapshot
    ? (period.rules_snapshot as PointRule[])
    : (await loadRules(supabase)).filter((r) => r.is_active !== false)
  const { data: rows } = await supabase.from('pfotm_entries').select('id, staff_id, display_name, auto_metrics, override_metrics, excluded').eq('period_id', periodId)
  const entries = rows ?? []
  const board = rankBoard(
    entries.filter((e) => !e.excluded).map((e) => ({
      key: e.id, name: e.display_name, metrics: mergeMetrics((e.auto_metrics ?? {}) as Metrics, (e.override_metrics ?? {}) as Metrics),
    })),
    rules,
    period?.working_days ?? 0,
  )
  for (const row of board) {
    await supabase.from('pfotm_entries').update({
      metrics: row.metrics, points_breakdown: row.breakdown, total_points: row.total, rank: row.rank, kpis: row.kpis, updated_by: userId,
    }).eq('id', row.key)
  }
  for (const e of entries.filter((x) => x.excluded)) {
    await supabase.from('pfotm_entries').update({ metrics: null, points_breakdown: null, total_points: null, rank: null, kpis: null }).eq('id', e.id)
  }
  return { rules, board }
}

export async function lockPfotmPeriod(periodId: string): Promise<Result<{ champion: string | null }>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!INPUT_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses.')
  const { supabase } = actor
  const { data: period } = await supabase.from('pfotm_periods').select('*').eq('id', periodId).maybeSingle()
  if (!period) return fail('Periode tidak ditemukan.')
  if (period.is_locked) return fail('Periode sudah dikunci.')

  const { rules, board } = await freezePeriod(supabase, periodId, actor.userId, false)
  const { error } = await supabase.from('pfotm_periods').update({
    is_locked: true, locked_by: actor.userId, locked_at: new Date().toISOString(),
    rules_snapshot: rules.map((r) => ({ metric_key: r.metric_key, metric_label: r.metric_label, weight: r.weight, is_penalty: r.is_penalty })),
  }).eq('id', periodId)
  if (error) return fail(error.message)

  const champion = board[0]?.name ?? null
  logActivity({
    supabase, userId: actor.userId, action: 'update', resourceType: 'pfotm_period', resourceId: periodId,
    resourceLabel: `PFOTM ${MONTH_NAMES[period.period_month - 1]} ${period.period_year}`, branchId: period.branch_id,
    oldValues: { is_locked: false }, newValues: { is_locked: true, champion, participants: board.length },
  })
  return ok({ champion })
}

export async function unlockPfotmPeriod(periodId: string, reason: string): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (actor.role !== 'director') return fail('Hanya direktur yang dapat membuka kunci periode PFOTM.')
  if (!reason.trim()) return fail('Alasan wajib diisi.')
  const { data: period } = await actor.supabase.from('pfotm_periods').select('*').eq('id', periodId).maybeSingle()
  if (!period) return fail('Periode tidak ditemukan.')
  const { error } = await actor.supabase.from('pfotm_periods')
    .update({ is_locked: false, locked_by: null, locked_at: null, rules_snapshot: null }).eq('id', periodId)
  if (error) return fail(error.message)
  logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'update', resourceType: 'pfotm_period', resourceId: periodId,
    resourceLabel: `PFOTM ${MONTH_NAMES[period.period_month - 1]} ${period.period_year}`, branchId: period.branch_id,
    oldValues: { is_locked: true }, newValues: { is_locked: false, reason: reason.trim() },
  })
  return ok(null)
}

// ── Point rules ─────────────────────────────────────────────────────────────

export async function savePointRule(input: {
  metric_key: string
  metric_label: string
  weight: number
  is_active: boolean
  isNew?: boolean
}): Promise<Result> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  if (!RULE_ROLES.includes(actor.role)) return fail('Anda tidak memiliki akses ke aturan poin.')
  if (!Number.isFinite(input.weight) || Math.abs(input.weight) > 1000) return fail('Bobot tidak valid.')
  const key = input.metric_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (!key || !input.metric_label.trim()) return fail('Kode dan nama metrik wajib diisi.')
  const { supabase } = actor
  const { data: before } = await supabase.from('pfotm_point_rules').select('*').eq('metric_key', key).maybeSingle()
  if (input.isNew && before) return fail('Kode metrik sudah ada.')
  const row = {
    metric_key: key, metric_label: input.metric_label.trim(), weight: input.weight, is_penalty: input.weight < 0,
    is_active: input.is_active, updated_by: actor.userId,
    ...(input.isNew ? { source: 'manual', sort_order: 100 } : {}),
  }
  const { error } = input.isNew
    ? await supabase.from('pfotm_point_rules').insert(row)
    : await supabase.from('pfotm_point_rules').update(row).eq('metric_key', key)
  if (error) return fail(error.message)
  logActivity({
    supabase, userId: actor.userId, action: input.isNew ? 'create' : 'update', resourceType: 'pfotm_rule',
    resourceId: key, resourceLabel: row.metric_label,
    oldValues: before ? { weight: Number(before.weight), is_active: before.is_active, metric_label: before.metric_label } : null,
    newValues: { weight: row.weight, is_active: row.is_active, metric_label: row.metric_label },
  })
  return ok(null)
}

// ── History & KPIs ──────────────────────────────────────────────────────────

export interface PfotmHistoryRow {
  period_month: number
  working_days: number
  entries: { name: string; staff_id: string | null; metrics: Metrics; total_points: number; rank: number; kpis: Record<string, number> }[]
}

export async function getPfotmHistory(branchId: string, year: number): Promise<Result<PfotmHistoryRow[]>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const { data: periods, error } = await actor.supabase
    .from('pfotm_periods')
    .select('id, period_month, working_days, pfotm_entries(display_name, staff_id, metrics, total_points, rank, kpis)')
    .eq('branch_id', branchId).eq('period_year', year).eq('is_locked', true)
    .order('period_month')
  if (error) return fail(error.message)
  type Row = { period_month: number; working_days: number; pfotm_entries: { display_name: string; staff_id: string | null; metrics: Metrics | null; total_points: number | null; rank: number | null; kpis: Record<string, number> | null }[] }
  return ok(((periods ?? []) as unknown as Row[]).map((p) => ({
    period_month: p.period_month,
    working_days: p.working_days,
    entries: p.pfotm_entries
      .filter((e) => e.rank !== null)
      .map((e) => ({ name: e.display_name, staff_id: e.staff_id, metrics: e.metrics ?? {}, total_points: Number(e.total_points), rank: e.rank!, kpis: e.kpis ?? {} }))
      .sort((a, b) => a.rank - b.rank),
  })))
}
