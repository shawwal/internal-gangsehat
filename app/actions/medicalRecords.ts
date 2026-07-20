'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import type { UserRole } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────
export type RecordCompleteness = 'all' | 'incomplete' | 'complete'
export type RecordPeriod = '7' | '30' | '90' | 'all'
export type RecordSortOrder = 'asc' | 'desc'
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

// A visit is "lengkap" (complete) once diagnosis, treatment, and regio are all
// filled — the exact same signal sendMedicalRecordReminder() and the
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
    query = query.or('diagnosis.is.null,treatment.is.null,regio.is.null')
  } else if (params.completeness === 'complete') {
    query = query.not('diagnosis', 'is', null).not('treatment', 'is', null).not('regio', 'is', null)
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

  const from = (params.page - 1) * params.pageSize
  const ascending = params.sortOrder === 'asc'

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

  const { data, count, error } = await query
    .order('visit_date', { ascending })
    .order('visit_time', { ascending, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, from + params.pageSize - 1)

  if (error || !data) return { rows: [], total: 0, scope: viewer.scope }

  // Batch-decrypt patient names for just this page — never for the full result set.
  const pagePatientIds = [...new Set(data.map((v) => v.patient_id as string))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone')
    .in('id', pagePatientIds)

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
  const rows: MedicalRecordRow[] = (data as any[]).map((v) => ({
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
    is_complete:           !!(v.diagnosis && v.treatment && v.regio),
  }))

  return { rows, total: count ?? 0, scope: viewer.scope }
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
