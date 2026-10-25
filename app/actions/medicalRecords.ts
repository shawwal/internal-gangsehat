'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { isRegioRequired } from '@/lib/visitRouting'
import { getEffectivePackageServiceType } from '@/lib/serviceType'
import type { GriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import {
  GRIYA_RECORD_EMBED, fetchGriyaBranchIds, resolveGriyaRecordStates, type GriyaRecordVisit,
} from '@/lib/griyaRecordCompletion'
import type { UserRole } from '@/types'

// service_types where regio is compulsory, formatted for PostgREST in.() lists
const REGIO_REQUIRED_IN = '("TERAPI AWAL","TA VISIT")'

// Package sessions can be stored with the literal 'SESI TERAPI'/'SESI VISIT'
// service_type even once tied to a package (package_id set) — see
// getEffectivePackageServiceType's own comment. /visits and the package detail
// page both display the *effective* PAKET variant for those rows, so this filter
// (and the row's displayed service_type below) need to match: filtering by
// 'PAKET TERAPI' must also catch package-linked 'SESI TERAPI' rows, and
// filtering by 'SESI TERAPI' must exclude them.
const PACKAGE_VARIANT_OF: Record<string, string> = {
  'SESI TERAPI': 'PAKET TERAPI',
  'SESI VISIT':  'PAKET VISIT',
}
const SESI_EQUIVALENT_OF: Record<string, string> = Object.fromEntries(
  Object.entries(PACKAGE_VARIANT_OF).map(([sesi, paket]) => [paket, sesi]),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyServiceTypeFilter(query: any, serviceType: string) {
  const sesiEquivalent = SESI_EQUIVALENT_OF[serviceType]
  if (sesiEquivalent) {
    // e.g. serviceType === 'PAKET TERAPI' → literal PAKET TERAPI rows, or
    // SESI TERAPI rows that turned out to be package-linked.
    return query.or(`service_type.eq."${serviceType}",and(service_type.eq."${sesiEquivalent}",package_id.not.is.null)`)
  }
  if (PACKAGE_VARIANT_OF[serviceType]) {
    // e.g. serviceType === 'SESI TERAPI' → literal SESI TERAPI rows with no
    // package attached (package-linked ones display/filter as PAKET TERAPI).
    return query.eq('service_type', serviceType).is('package_id', null)
  }
  return query.eq('service_type', serviceType)
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type RecordCompleteness = 'all' | 'incomplete' | 'complete'
export type RecordPeriod = '7' | '30' | '90' | 'all'
export type RecordSortOrder = 'asc' | 'desc'
export type RecordGroupBy = 'date' | 'patient' | 'therapist'
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
  // 1-based position of this visit within its package's session history
  // (oldest first), matching the "Pertemuan N" numbering shown on the
  // patient packages page. Null when the visit isn't tied to a package.
  pertemuan_number: number | null
  // Griya Anak branch visits use their own forms (not the adult MSK ones).
  // is_griya is true for any visit in a Griya-enabled branch; griya_route is
  // the Griya form it opens, or null when that service type has none.
  is_griya: boolean
  griya_route: GriyaVisitFormRoute | null
  // Status of the Griya record (intake or session note) — Griya forms have no
  // tindakan/regio, so is_complete for Griya rows follows this instead.
  griya_status: 'completed' | 'draft' | null
}

export interface MedicalRecordsParams {
  page: number
  pageSize: number
  search: string
  completeness: RecordCompleteness
  period: RecordPeriod
  dateFrom?: string  // YYYY-MM-DD inclusive — either bound set overrides `period`
  dateTo?: string    // YYYY-MM-DD inclusive
  sortOrder: RecordSortOrder
  // 'date' (default, DB-level pagination) or a name sort — 'patient' /
  // 'therapist' (in-memory). For name sorts `sortOrder` is the name direction
  // (asc = A–Z); each person's visits stay newest first.
  groupBy?: RecordGroupBy
  staffId?: string   // 'all' or uuid — only honored for team-scope viewers
  branchId?: string  // 'all' or uuid — only honored for director
  serviceType?: string  // 'all' or a ServiceType value (e.g. 'TERAPI AWAL')
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
  // Home branch plus every branch they've recently attended a completed visit
  // in — the branch filter narrows the therapist dropdown by this, so a
  // therapist covering another branch still shows up there.
  branch_ids: string[]
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
const TEAM_ROLES: UserRole[] = ['admin', 'director', 'manager', 'hr']

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
// Griya Anak branches (`griyaIds`) keep their own rekam medis, which SQL here
// can't see — their rows pass the completeness filter untouched and the caller
// filters them in-app (lib/griyaRecordCompletion.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyScopedFilters(query: any, viewer: ViewerContext, params: MedicalRecordsParams, griyaIds: string[] = []) {
  query = query.eq('status', 'completed').not('attending_staff_id', 'is', null)

  if (viewer.scope === 'own') {
    query = query.eq('attending_staff_id', viewer.userId)
  } else {
    if (params.branchId && params.branchId !== 'all') query = query.eq('branch_id', params.branchId)
    if (params.staffId && params.staffId !== 'all') query = query.eq('attending_staff_id', params.staffId)
  }

  if (params.serviceType && params.serviceType !== 'all') query = applyServiceTypeFilter(query, params.serviceType)

  if (params.dateFrom || params.dateTo) {
    if (params.dateFrom) query = query.gte('visit_date', params.dateFrom)
    if (params.dateTo)   query = query.lte('visit_date', params.dateTo)
  } else {
    const startDate = periodStartDate(params.period)
    if (startDate) query = query.gte('visit_date', startDate)
  }

  const griyaPass = griyaIds.length > 0 ? `branch_id.in.(${griyaIds.join(',')}),` : ''
  if (params.completeness === 'incomplete') {
    query = query.or(`${griyaPass}diagnosis.is.null,treatment.is.null,and(service_type.in.${REGIO_REQUIRED_IN},regio.is.null)`)
  } else if (params.completeness === 'complete') {
    query = query.or(
      `${griyaPass}and(diagnosis.not.is.null,treatment.not.is.null,or(regio.not.is.null,service_type.not.in.${REGIO_REQUIRED_IN}))`,
    )
  }

  return query
}

// Reads every row of a query in 1000-row pages (PostgREST's max-rows cap).
// `build` must apply a stable order. Returns null on error.
async function fetchAllPages<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[] | null> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error || !data) return from === 0 ? null : out
    out.push(...data)
    if (data.length < PAGE) return out
  }
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
  const sortByName = params.groupBy === 'patient' || params.groupBy === 'therapist'

  // Griya completeness lives in other tables, so a completeness filter that can
  // reach a Griya branch fetches the scoped set and filters/paginates in memory.
  const griyaIds = await fetchGriyaBranchIds(supabase)
  const griyaInScope = griyaIds.length > 0 && (
    !params.branchId || params.branchId === 'all' || griyaIds.includes(params.branchId)
  )
  const griyaFilter = params.completeness !== 'all' && griyaInScope
  const inMemory = sortByName || griyaFilter

  let query = supabase
    .from('patient_visits')
    .select(`
      id, patient_id, branch_id, visit_date, visit_time, service_type, package_id,
      attending_staff_id, griya_slot_id, diagnosis, treatment, regio,
      internal_profiles!attending_staff_id(full_name, nickname),
      branches!branch_id(name),
      ${GRIYA_RECORD_EMBED}
    `, { count: 'exact' })

  query = applyScopedFilters(query, viewer, params, griyaFilter ? griyaIds : [])
  if (patientIds) query = query.in('patient_id', patientIds)
  query = query
    .order('visit_date', { ascending })
    .order('visit_time', { ascending, nullsFirst: false })
    .order('id', { ascending: true })

  // Patient names are encrypted at rest, so they can't be ORDER BY'd in SQL.
  // Name sorts ("Pasien" / "Terapis" — the therapist label is nickname-or-name,
  // which SQL can't order by either) fetch the full scoped result set (bounded
  // — clinic-scale incomplete-record counts are dozens, not thousands), decrypt
  // every name once, sort in application code, then paginate in memory. The
  // default "Tanggal" mode keeps the efficient DB-level range() pagination.
  const from = (params.page - 1) * params.pageSize
  const { data: fetched, count, error } = inMemory
    ? await query.limit(5000)
    : await query.range(from, from + params.pageSize - 1)

  if (error || !fetched) return { rows: [], total: 0, scope: viewer.scope }

  // Which of these visits belong to a Griya Anak branch — those route to the
  // Griya intake / rekam medis pages instead of the adult forms, and their
  // completeness follows the Griya form status instead of diagnosis/tindakan/regio.
  const griyaBranchIds = new Set(griyaIds)
  const griyaStates = await resolveGriyaRecordStates(
    supabase,
    fetched.filter((v) => griyaBranchIds.has(v.branch_id as string)) as unknown as GriyaRecordVisit[],
  )

  let data = fetched
  let total = count ?? 0
  if (griyaFilter) {
    const want = params.completeness === 'complete'
    data = fetched.filter((v) => {
      const st = griyaStates.get(v.id as string)
      return !st || st.complete === want
    })
    total = data.length
  }
  // In-memory date mode: paginate before the per-row lookups below.
  if (inMemory && !sortByName) data = data.slice(from, from + params.pageSize)

  // Batch-decrypt patient names — for the full matched set in "Pasien" mode,
  // for just this page otherwise.
  const namePatientIds = [...new Set(data.map((v) => v.patient_id as string))]
  const { data: patients } = namePatientIds.length > 0
    ? await supabase
        .from('patients')
        .select('id, encrypted_name, encrypted_phone')
        .in('id', namePatientIds)
    : { data: [] }

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

  // "Pertemuan N" — 1-based position of each visit within its package's full
  // session history (oldest first), same numbering as "Riwayat Sesi" on the
  // patient packages page (SessionList.tsx). Needs a second query because a
  // package's other sessions can fall outside this page's date/staff/branch
  // filters or pagination window, so they wouldn't otherwise be in `data`.
  const packageIds = [...new Set(
    (data as { package_id: string | null }[]).map((v) => v.package_id).filter((id): id is string => !!id),
  )]
  const pertemuanMap = new Map<string, number>()
  if (packageIds.length > 0) {
    const { data: packageVisits } = await supabase
      .from('patient_visits')
      .select('id, package_id, visit_date, visit_time')
      .in('package_id', packageIds)
      .neq('status', 'cancelled')
      .order('visit_date', { ascending: true })
      .order('visit_time', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    const counters = new Map<string, number>()
    for (const pv of packageVisits ?? []) {
      const n = (counters.get(pv.package_id as string) ?? 0) + 1
      counters.set(pv.package_id as string, n)
      pertemuanMap.set(pv.id, n)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: MedicalRecordRow[] = (data as any[]).map((v) => {
    const griya = griyaStates.get(v.id)
    return {
      id:                    v.id,
      patient_id:            v.patient_id,
      patient_name:          nameMap.get(v.patient_id) ?? 'Pasien',
      branch_id:             v.branch_id,
      branch_name:           v.branches?.name ?? '',
      visit_date:            v.visit_date,
      visit_time:            v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      service_type:          getEffectivePackageServiceType(v.service_type, v.package_id) ?? v.service_type,
      attending_staff_id:    v.attending_staff_id,
      attending_staff_name:  v.internal_profiles?.nickname || v.internal_profiles?.full_name || '—',
      diagnosis:             v.diagnosis,
      treatment:             v.treatment,
      regio:                 v.regio,
      is_complete:           griya
        ? griya.status === 'completed'
        : !!(v.diagnosis && v.treatment && (!isRegioRequired(v.service_type) || v.regio)),
      pertemuan_number:      v.package_id ? pertemuanMap.get(v.id) ?? null : null,
      is_griya:              !!griya,
      griya_route:           griya?.route ?? null,
      griya_status:          griya?.status ?? null,
    }
  })

  if (sortByName) {
    const nameOf = (r: MedicalRecordRow) => params.groupBy === 'therapist' ? r.attending_staff_name : r.patient_name
    const idOf = (r: MedicalRecordRow) => params.groupBy === 'therapist' ? r.attending_staff_id : r.patient_id
    rows.sort((a, b) => {
      const byName = nameOf(a).localeCompare(nameOf(b), 'id', { sensitivity: 'base' })
      if (byName !== 0) return ascending ? byName : -byName
      // Same name, different person — keep each one's visits together.
      if (idOf(a) !== idOf(b)) return idOf(a).localeCompare(idOf(b))
      const da = `${a.visit_date} ${a.visit_time ?? '00:00'}`
      const db = `${b.visit_date} ${b.visit_time ?? '00:00'}`
      return db.localeCompare(da)
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

  // Griya branches are counted from their own rekam medis, the rest in SQL.
  const griyaIds = await fetchGriyaBranchIds(supabase)
  const griyaIn = `(${griyaIds.join(',')})`

  async function countFor(completeness: RecordCompleteness) {
    let q = supabase.from('patient_visits').select('id', { count: 'exact', head: true })
    q = applyScopedFilters(q, viewer, { ...params, completeness } as MedicalRecordsParams)
    if (griyaIds.length > 0) q = q.not('branch_id', 'in', griyaIn)
    if (patientIds) q = q.in('patient_id', patientIds)
    const { count } = await q
    return count ?? 0
  }

  async function griyaCounts() {
    if (griyaIds.length === 0) return { complete: 0, incomplete: 0 }
    if (params.branchId && params.branchId !== 'all' && !griyaIds.includes(params.branchId)) {
      return { complete: 0, incomplete: 0 }
    }
    const visits = await fetchAllPages((from, to) => {
      let q = supabase
        .from('patient_visits')
        .select(`id, branch_id, service_type, griya_slot_id, attending_staff_id, ${GRIYA_RECORD_EMBED}`)
        .in('branch_id', griyaIds)
      q = applyScopedFilters(q, viewer, { ...params, completeness: 'all' } as MedicalRecordsParams)
      if (patientIds) q = q.in('patient_id', patientIds)
      return q.order('id').range(from, to)
    })
    const states = await resolveGriyaRecordStates(supabase, (visits ?? []) as unknown as GriyaRecordVisit[])
    let complete = 0, incomplete = 0
    for (const st of states.values()) {
      if (st.complete === true) complete++
      else if (st.complete === false) incomplete++
    }
    return { complete, incomplete }
  }

  const [complete, incomplete, griya] = await Promise.all([countFor('complete'), countFor('incomplete'), griyaCounts()])
  return { complete: complete + griya.complete, incomplete: incomplete + griya.incomplete }
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

  const startDate = periodStartDate(params.period)
  // Paged — a team's visits over 30–90 days easily pass PostgREST's 1000-row cap.
  const data = await fetchAllPages((from, to) => {
    let query = supabase
      .from('patient_visits')
      .select(`id, attending_staff_id, branch_id, diagnosis, treatment, regio, service_type, visit_date, griya_slot_id, ${GRIYA_RECORD_EMBED}`)
      .eq('status', 'completed')
      .not('attending_staff_id', 'is', null)
    if (isDirector && params.branchId && params.branchId !== 'all') {
      query = query.eq('branch_id', params.branchId)
    }
    if (startDate) query = query.gte('visit_date', startDate)
    return query.order('id').range(from, to)
  })
  if (!data) return { rows: [], isDirector }

  // Griya Anak visits are judged by their own rekam medis (Terapi Awal / catatan sesi).
  const griyaBranchIds = new Set(await fetchGriyaBranchIds(supabase))
  const griyaStates = await resolveGriyaRecordStates(
    supabase,
    data.filter((v) => griyaBranchIds.has(v.branch_id as string)) as unknown as GriyaRecordVisit[],
  )

  interface Agg {
    staff_id: string
    branch_id: string | null
    total: number
    complete: number
    incomplete: number
    oldestIncompleteDate: string | null
  }
  const aggMap = new Map<string, Agg>()
  for (const v of data as unknown as { id: string; attending_staff_id: string; branch_id: string | null; diagnosis: string | null; treatment: string | null; regio: string | null; service_type: string | null; visit_date: string }[]) {
    const griya = griyaStates.get(v.id)
    if (griya && griya.complete === null) continue  // no Griya form for this visit
    const sid = v.attending_staff_id
    let agg = aggMap.get(sid)
    if (!agg) {
      agg = { staff_id: sid, branch_id: v.branch_id, total: 0, complete: 0, incomplete: 0, oldestIncompleteDate: null }
      aggMap.set(sid, agg)
    }
    agg.total++
    const isComplete = griya
      ? griya.complete === true
      : !!(v.diagnosis && v.treatment && (!isRegioRequired(v.service_type) || v.regio))
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
      .in('role', ['therapist', 'sport_massage_therapist', 'staff', 'manager'])
      .eq('is_active', true)
      .order('full_name'),
  ])

  // Where each therapist actually worked lately — a profile has one home
  // branch, but therapists cover other branches too.
  const visitBranches = new Map<string, Set<string>>()
  const since = periodStartDate('90')
  const pairs = await fetchAllPages<{ attending_staff_id: string; branch_id: string }>((from, to) =>
    supabase
      .from('patient_visits')
      .select('attending_staff_id, branch_id')
      .eq('status', 'completed')
      .not('attending_staff_id', 'is', null)
      .gte('visit_date', since!)
      .order('id')
      .range(from, to),
  )
  for (const v of pairs ?? []) {
    let set = visitBranches.get(v.attending_staff_id)
    if (!set) visitBranches.set(v.attending_staff_id, set = new Set())
    set.add(v.branch_id)
  }

  const staff: StaffOption[] = (staffRes.data ?? []).map((s: { id: string; full_name: string; nickname: string | null; branch_id: string | null }) => ({
    id:         s.id,
    label:      s.nickname?.trim() || s.full_name,
    branch_id:  s.branch_id,
    branch_ids: [...new Set([...(s.branch_id ? [s.branch_id] : []), ...(visitBranches.get(s.id) ?? [])])],
  }))

  return {
    scope:      'team',
    isDirector,
    branches:   (branchesRes.data ?? []) as BranchOption[],
    staff,
  }
}
