'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { isRegioRequired } from '@/lib/visitRouting'
import type { UserRole } from '@/types'

// service_types where regio is compulsory, formatted for PostgREST in.() lists
const REGIO_REQUIRED_IN = '("TERAPI AWAL","TA VISIT")'

// ── Types ──────────────────────────────────────────────────────────────────────
export type RecordCompleteness = 'all' | 'incomplete' | 'complete'
export type RecordPeriod = '7' | '30' | '90' | 'all'
export type RecordSortOrder = 'asc' | 'desc'
export type RecordGroupBy = 'date' | 'patient'
export type RecordScope = 'own' | 'team'

export interface MedicalRecordRow {
  id: string
  patient_id: string
  patient_name: string
  branch_id: string
  branch_name: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  attending_staff_id: string
  attending_staff_name: string
  diagnosis: string | null
  treatment: string | null
  regio: string | null
  is_complete: boolean
}

export interface MedicalRecordsParams {
  page: number
  pageSize: number
  search: string
  completeness: RecordCompleteness
  period: RecordPeriod
  sortOrder: RecordSortOrder
  groupBy?: RecordGroupBy  // 'date' (default, DB-level pagination) or 'patient' (in-memory)
  staffId?: string   // 'all' or uuid — only honored for team-scope viewers
  branchId?: string  // 'all' or uuid — only honored for director
}

export interface MedicalRecordsResult {
  rows: MedicalRecordRow[]
  total: number
  scope: RecordScope
}

export interface MedicalRecordsStats {
  complete: number
  incomplete: number
}

export interface BranchOption {
  id: string
  name: string
}

export interface StaffOption {
  id: string
  label: string
  branch_id: string | null
}

export interface RecordFilterOptions {
  scope: RecordScope
  isDirector: boolean
  branches: BranchOption[]
  staff: StaffOption[]
}

// Roles that supervise a clinic team and can see every therapist's records —
// mirrors REMIND_ROLES in app/actions/jadwal.ts, the existing convention for
// who may act on someone else's medical-record completeness.
const TEAM_ROLES: UserRole[] = ['admin', 'director', 'manager']

interface ViewerContext {
  userId: string
  role: UserRole
  branchId: string | null
  scope: RecordScope
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function resolveViewer(supabase: SupabaseServerClient): Promise<ViewerContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const role = profile.role as UserRole
  return {
    userId: user.id,
    role,
    branchId: profile.branch_id as string | null,
    scope: TEAM_ROLES.includes(role) ? 'team' : 'own',
  }
}

function periodStartDate(period: RecordPeriod): string | null {
  if (period === 'all') return null
  const d = new Date()
  d.setDate(d.getDate() - Number(period))
  return d.toISOString().slice(0, 10)
}

// Resolve patient IDs matching a name search via the plaintext `name_normalized`
// column (name/phone are AES-encrypted at rest, so they can't be ilike'd directly) —
// same two-step search idiom used elsewhere in this codebase (see CLAUDE.md).
async function searchPatientIds(supabase: SupabaseServerClient, term: string): Promise<string[]> {
  const { data } = await supabase
    .from('patients')
    .select('id')
    .ilike('name_normalized', `%${term}%`)
    .limit(1000)
  return (data ?? []).map((p: { id: string }) => p.id)
}

// A visit is "lengkap" (complete) once diagnosis and treatment are filled, and
// regio too — but only for assessment-type visits (TERAPI AWAL, TA VISIT), where
// it's compulsory. Same signal sendMedicalRecordReminder() and the
// jadwal-harian incomplete-records banner already use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyScopedFilters(query: any, viewer: ViewerContext, params: MedicalRecordsParams) {
  query = query.eq('status', 'completed').not('attending_staff_id', 'is', null)

  if (viewer.scope === 'own') {
    query = query.eq('attending_staff_id', viewer.userId)
  } else {
    if (params.branchId && params.branchId !== 'all') query = query.eq('branch_id', params.branchId)
    if (params.staffId && params.staffId !== 'all') query = query.eq('attending_staff_id', params.staffId)
  }

  const startDate = periodStartDate(params.period)
  if (startDate) query = query.gte('visit_date', startDate)

  if (params.completeness === 'incomplete') {
    query = query.or(`diagnosis.is.null,treatment.is.null,and(service_type.in.${REGIO_REQUIRED_IN},regio.is.null)`)
  } else if (params.completeness === 'complete') {
    query = query
      .not('diagnosis', 'is', null)
      .not('treatment', 'is', null)
      .or(`regio.not.is.null,service_type.not.in.${REGIO_REQUIRED_IN}`)
  }

  return query
}

// ── Paginated list ──────────────────────────────────────────────────────────────
export async function fetchMedicalRecords(params: MedicalRecordsParams): Promise<MedicalRecordsResult> {
  const supabase = await createClient()
  const viewer = await resolveViewer(supabase)
  if (!viewer) return { rows: [], total: 0, scope: 'own' }

  const search = params.search.trim().toLowerCase()
  let patientIds: string[] | null = null
  if (search) {
    patientIds = await searchPatientIds(supabase, search)
    if (patientIds.length === 0) return { rows: [], total: 0, scope: viewer.scope }
  }

  const ascending = params.sortOrder === 'asc'
  const groupByPatient = params.groupBy === 'patient'

  let query = supabase
    .from('patient_visits')
    .select(`
      id, patient_id, branch_id, visit_date, visit_time, service_type,
      attending_staff_id, diagnosis, treatment, regio,
      internal_profiles!attending_staff_id(full_name, nickname),
      branches!branch_id(name)
    `, { count: 'exact' })

  query = applyScopedFilters(query, viewer, params)
  if (patientIds) query = query.in('patient_id', patientIds)
  query = query
    .order('visit_date', { ascending })
    .order('visit_time', { ascending, nullsFirst: false })
    .order('id', { ascending: true })

  // Patient names are encrypted at rest, so they can't be ORDER BY'd in SQL.
  // "Pasien" mode fetches the full scoped result set (bounded — clinic-scale
  // incomplete-record counts are dozens, not thousands), decrypts every name
  // once, sorts by name in application code, then paginates in memory. The
  // default "Tanggal" mode keeps the efficient DB-level range() pagination.
  const from = (params.page - 1) * params.pageSize
  const { data, count, error } = groupByPatient
    ? await query.limit(5000)
    : await query.range(from, from + params.pageSize - 1)

  if (error || !data) return { rows: [], total: 0, scope: viewer.scope }

  // Batch-decrypt patient names — for the full matched set in "Pasien" mode,
  // for just this page otherwise.
  const namePatientIds = [...new Set(data.map((v) => v.patient_id as string))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone')
    .in('id', namePatientIds)

  const nameMap = new Map<string, string>()
  for (const p of patients ?? []) {
    try {
      const dec = decryptPatientPII({
        encrypted_name:  p.encrypted_name  ?? '',
        encrypted_phone: p.encrypted_phone ?? '',
      })
      nameMap.set(p.id, dec.name || 'Pasien')
    } catch {
      nameMap.set(p.id, 'Pasien')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: MedicalRecordRow[] = (data as any[]).map((v) => ({
    id:                    v.id,
    patient_id:            v.patient_id,
    patient_name:          nameMap.get(v.patient_id) ?? 'Pasien',
    branch_id:             v.branch_id,
    branch_name:           v.branches?.name ?? '',
    visit_date:            v.visit_date,
    visit_time:            v.visit_time ? String(v.visit_time).slice(0, 5) : null,
    service_type:          v.service_type,
    attending_staff_id:    v.attending_staff_id,
    attending_staff_name:  v.internal_profiles?.nickname || v.internal_profiles?.full_name || '—',
    diagnosis:             v.diagnosis,
    treatment:             v.treatment,
    regio:                 v.regio,
    is_complete:           !!(v.diagnosis && v.treatment && (!isRegioRequired(v.service_type) || v.regio)),
  }))

  let total = count ?? 0
  if (groupByPatient) {
    rows.sort((a, b) => {
      const byName = a.patient_name.localeCompare(b.patient_name, 'id')
      if (byName !== 0) return byName
      const da = `${a.visit_date} ${a.visit_time ?? '00:00'}`
      const db = `${b.visit_date} ${b.visit_time ?? '00:00'}`
      return ascending ? da.localeCompare(db) : db.localeCompare(da)
    })
    total = rows.length
    rows = rows.slice(from, from + params.pageSize)
  }

  return { rows, total, scope: viewer.scope }
}

// ── Stats (complete / incomplete counts, ignoring the completeness filter) ──────
export async function fetchMedicalRecordStats(
  params: Omit<MedicalRecordsParams, 'page' | 'pageSize' | 'completeness' | 'sortOrder'>,
): Promise<MedicalRecordsStats> {
  const supabase = await createClient()
  const resolvedViewer = await resolveViewer(supabase)
  if (!resolvedViewer) return { complete: 0, incomplete: 0 }
  const viewer: ViewerContext = resolvedViewer

  const search = params.search.trim().toLowerCase()
  let patientIds: string[] | null = null
  if (search) {
    patientIds = await searchPatientIds(supabase, search)
    if (patientIds.length === 0) return { complete: 0, incomplete: 0 }
  }

  async function countFor(completeness: RecordCompleteness) {
    let q = supabase.from('patient_visits').select('id', { count: 'exact', head: true })
    q = applyScopedFilters(q, viewer, { ...params, completeness } as MedicalRecordsParams)
    if (patientIds) q = q.in('patient_id', patientIds)
    const { count } = await q
    return count ?? 0
  }

  const [complete, incomplete] = await Promise.all([countFor('complete'), countFor('incomplete')])
  return { complete, incomplete }
}

// ── Per-therapist completion rollup (team scope only) ───────────────────────────
export interface TherapistRecordStat {
  staff_id: string
  name: string
  avatar_url: string | null
  branch_id: string | null
  branch_name: string
  total: number
  complete: number
  incomplete: number
  completionRate: number      // 0-100, rounded
  oldestIncompleteDate: string | null
}

export async function fetchTherapistRecordStats(params: {
  period: RecordPeriod
  branchId?: string  // 'all' or uuid — honored only for director
}): Promise<{ rows: TherapistRecordStat[]; isDirector: boolean }> {
  const supabase = await createClient()
  const viewer = await resolveViewer(supabase)
  if (!viewer || viewer.scope !== 'team') return { rows: [], isDirector: false }

  const isDirector = viewer.role === 'director'

  let query = supabase
    .from('patient_visits')
    .select('attending_staff_id, branch_id, diagnosis, treatment, regio, service_type, visit_date')
    .eq('status', 'completed')
    .not('attending_staff_id', 'is', null)

  if (isDirector && params.branchId && params.branchId !== 'all') {
    query = query.eq('branch_id', params.branchId)
  }
  const startDate = periodStartDate(params.period)
  if (startDate) query = query.gte('visit_date', startDate)

  const { data, error } = await query
  if (error || !data) return { rows: [], isDirector }

  interface Agg {
    staff_id: string
    branch_id: string | null
    total: number
    complete: number
    incomplete: number
    oldestIncompleteDate: string | null
  }
  const aggMap = new Map<string, Agg>()
  for (const v of data as { attending_staff_id: string; branch_id: string | null; diagnosis: string | null; treatment: string | null; regio: string | null; service_type: string | null; visit_date: string }[]) {
    const sid = v.attending_staff_id
    let agg = aggMap.get(sid)
    if (!agg) {
      agg = { staff_id: sid, branch_id: v.branch_id, total: 0, complete: 0, incomplete: 0, oldestIncompleteDate: null }
      aggMap.set(sid, agg)
    }
    agg.total++
    const isComplete = !!(v.diagnosis && v.treatment && (!isRegioRequired(v.service_type) || v.regio))
    if (isComplete) {
      agg.complete++
    } else {
      agg.incomplete++
      if (!agg.oldestIncompleteDate || v.visit_date < agg.oldestIncompleteDate) {
        agg.oldestIncompleteDate = v.visit_date
      }
    }
  }

  const staffIds = [...aggMap.keys()]
  if (staffIds.length === 0) return { rows: [], isDirector }

  const [{ data: staffRows }, { data: branchRows }] = await Promise.all([
    supabase
      .from('internal_profiles')
      .select('id, full_name, nickname, avatar_url')
      .in('id', staffIds),
    supabase.from('branches').select('id, name'),
  ])

  const nameMap = new Map<string, { name: string; avatar_url: string | null }>()
  for (const s of staffRows ?? []) {
    nameMap.set(s.id, { name: s.nickname?.trim() || s.full_name, avatar_url: s.avatar_url ?? null })
  }
  const branchNameMap = new Map<string, string>()
  for (const b of branchRows ?? []) branchNameMap.set(b.id, b.name)

  const rows: TherapistRecordStat[] = [...aggMap.values()].map((agg) => ({
    staff_id:             agg.staff_id,
    name:                 nameMap.get(agg.staff_id)?.name ?? '—',
    avatar_url:           nameMap.get(agg.staff_id)?.avatar_url ?? null,
    branch_id:            agg.branch_id,
    branch_name:          agg.branch_id ? (branchNameMap.get(agg.branch_id) ?? '') : '',
    total:                agg.total,
    complete:             agg.complete,
    incomplete:           agg.incomplete,
    completionRate:       agg.total > 0 ? Math.round((agg.complete / agg.total) * 100) : 100,
    oldestIncompleteDate: agg.oldestIncompleteDate,
  }))

  rows.sort((a, b) => a.completionRate - b.completionRate || b.incomplete - a.incomplete)

  return { rows, isDirector }
}

// ── Filter dropdown options (team scope only) ───────────────────────────────────
export async function fetchRecordFilterOptions(): Promise<RecordFilterOptions> {
  const supabase = await createClient()
  const viewer = await resolveViewer(supabase)
  if (!viewer || viewer.scope !== 'team') {
    return { scope: 'own', isDirector: false, branches: [], staff: [] }
  }

  const isDirector = viewer.role === 'director'

  const [branchesRes, staffRes] = await Promise.all([
    isDirector
      ? supabase.from('branches').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: null }),
    supabase
      .from('internal_profiles')
      .select('id, full_name, nickname, branch_id')
      .in('role', ['therapist', 'staff', 'manager'])
      .eq('is_active', true)
      .order('full_name'),
  ])

  const staff: StaffOption[] = (staffRes.data ?? []).map((s: { id: string; full_name: string; nickname: string | null; branch_id: string | null }) => ({
    id:        s.id,
    label:     s.nickname?.trim() || s.full_name,
    branch_id: s.branch_id,
  }))

  return {
    scope:      'team',
    isDirector,
    branches:   (branchesRes.data ?? []) as BranchOption[],
    staff,
  }
}
