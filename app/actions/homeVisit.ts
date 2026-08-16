'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { generateOrderId } from '@/lib/internal/orderId'
import { logActivity } from '@/lib/activityLog'
import type { BodyRegion, ServiceType, UserRole, VisitStatus } from '@/types'
import type { HomeVisitSessionRow, HomeVisitStatsData } from '@/components/homeVisit/types'

const HOME_VISIT_TYPES: ServiceType[] = ['TA VISIT', 'SESI VISIT', 'PAKET VISIT']

// A visit's own service_type must never be 'PAKET VISIT' — that value is only
// used as the transactions/patient_packages category for a package purchase.
// Individual sessions consuming a package are logged as TA VISIT / SESI VISIT
// with package_id pointing at the package.
const NO_PACKAGE_SERVICE_TYPES = new Set(['TA VISIT'])
const PACKAGE_CATEGORIES = new Set(['PAKET VISIT', 'PAKET KLINIK'])

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface ViewerContext {
  userId: string
  role: UserRole
  branchId: string | null
}

async function resolveViewer(supabase: SupabaseServerClient): Promise<ViewerContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null
  return { userId: user.id, role: profile.role as UserRole, branchId: profile.branch_id as string | null }
}

// director sees every branch; everyone else is scoped to their own branch (via RLS + explicit filter)
function isCrossBranch(role: UserRole) {
  return role === 'director'
}

async function searchPatientIds(supabase: SupabaseServerClient, term: string): Promise<string[]> {
  const { data } = await supabase
    .from('patients')
    .select('id')
    .ilike('name_normalized', `%${term}%`)
    .limit(1000)
  return (data ?? []).map((p: { id: string }) => p.id)
}

// ── Daily Session Log — one row per home-visit session ──────────────────────────
export async function fetchHomeVisitSessions(params: {
  search: string
  branchId?: string // 'all' or uuid — only honored for director
  page: number
  pageSize: number
}): Promise<{ rows: HomeVisitSessionRow[]; total: number }> {
  const supabase = await createClient()
  const viewer = await resolveViewer(supabase)
  if (!viewer) return { rows: [], total: 0 }

  const search = params.search.trim().toLowerCase()
  let patientIds: string[] | null = null
  if (search) {
    patientIds = await searchPatientIds(supabase, search)
    if (patientIds.length === 0) return { rows: [], total: 0 }
  }

  let visitQuery = supabase
    .from('patient_visits')
    .select('id, patient_id, branch_id, visit_date, service_type, attending_staff_id, package_id, status, branches!branch_id(name)')
    .in('service_type', HOME_VISIT_TYPES)
    .neq('status', 'cancelled')
    .order('visit_date', { ascending: false })

  if (isCrossBranch(viewer.role)) {
    if (params.branchId && params.branchId !== 'all') visitQuery = visitQuery.eq('branch_id', params.branchId)
  } else if (viewer.branchId) {
    visitQuery = visitQuery.eq('branch_id', viewer.branchId)
  } else {
    return { rows: [], total: 0 }
  }
  if (patientIds) visitQuery = visitQuery.in('patient_id', patientIds)

  const { data: visits } = await visitQuery.limit(2000)
  if (!visits?.length) return { rows: [], total: 0 }

  const total = visits.length
  const from = (params.page - 1) * params.pageSize
  const pageVisits = visits.slice(from, from + params.pageSize)

  const patientIdsOnPage = [...new Set(pageVisits.map((v) => v.patient_id as string))]
  const staffIdsOnPage   = [...new Set(pageVisits.map((v) => v.attending_staff_id as string).filter(Boolean))]
  const packageIdsOnPage = [...new Set(pageVisits.map((v) => v.package_id as string).filter(Boolean))]
  const visitIdsOnPage   = pageVisits.map((v) => v.id as string)

  const [{ data: patients }, { data: staff }, { data: packages }, { data: txns }] = await Promise.all([
    supabase.from('patients').select('id, encrypted_name, encrypted_phone, encrypted_address, no_rm').in('id', patientIdsOnPage),
    staffIdsOnPage.length > 0
      ? supabase.from('internal_profiles').select('id, full_name').in('id', staffIdsOnPage)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    packageIdsOnPage.length > 0
      ? supabase.from('patient_packages_with_stats').select('id, jenis_paket, used_sessions, total_sessions').in('id', packageIdsOnPage)
      : Promise.resolve({ data: [] as { id: string; jenis_paket: string | null; used_sessions: number; total_sessions: number }[] }),
    visitIdsOnPage.length > 0
      ? supabase.from('transactions').select('visit_id, category, payment_status, outstanding, status').in('visit_id', visitIdsOnPage).neq('status', 'rejected')
      : Promise.resolve({ data: [] as { visit_id: string; category: string; payment_status: string | null; outstanding: number; status: string }[] }),
  ])

  const nameMap = new Map<string, string>()
  const addrMap = new Map<string, string | null>()
  const rmMap   = new Map<string, string | null>()
  for (const p of patients ?? []) {
    rmMap.set(p.id, p.no_rm ?? null)
    try {
      const dec = decryptPatientPII({
        encrypted_name:    p.encrypted_name ?? '',
        encrypted_phone:   p.encrypted_phone ?? '',
        encrypted_address: p.encrypted_address ?? undefined,
      })
      nameMap.set(p.id, dec.name || 'Pasien')
      addrMap.set(p.id, dec.address ?? null)
    } catch {
      nameMap.set(p.id, 'Pasien')
      addrMap.set(p.id, null)
    }
  }

  const staffMap = new Map((staff ?? []).map((s) => [s.id, s.full_name as string]))
  const packageMap = new Map((packages ?? []).map((p) => [p.id, {
    jenis_paket:    (p.jenis_paket ?? null) as 'P1' | 'P2' | null,
    used_sessions:  Number(p.used_sessions ?? 0),
    total_sessions: Number(p.total_sessions ?? 0),
  }]))

  const payMap = new Map<string, { payment_status: string | null; outstanding: number }>()
  for (const t of txns ?? []) {
    if (PACKAGE_CATEGORIES.has(t.category ?? '')) continue
    const vid = t.visit_id as string
    const existing = payMap.get(vid)
    if (!existing || (t.outstanding ?? 0) < existing.outstanding) {
      payMap.set(vid, { payment_status: t.payment_status, outstanding: t.outstanding ?? 0 })
    }
  }

  const rows: HomeVisitSessionRow[] = pageVisits.map((v) => {
    const pay = payMap.get(v.id as string)
    return {
      id:                   v.id as string,
      visit_date:           v.visit_date as string,
      patient_id:           v.patient_id as string,
      patient_name:         nameMap.get(v.patient_id as string) ?? 'Pasien',
      patient_address:      addrMap.get(v.patient_id as string) ?? null,
      no_rm:                rmMap.get(v.patient_id as string) ?? null,
      branch_id:            v.branch_id as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branch_name:          (v as any).branches?.name ?? '',
      service_type:         v.service_type as ServiceType | null,
      attending_staff_name: v.attending_staff_id ? (staffMap.get(v.attending_staff_id as string) ?? null) : null,
      package:              v.package_id ? (packageMap.get(v.package_id as string) ?? null) : null,
      payment_status:       (pay?.payment_status as HomeVisitSessionRow['payment_status']) ?? null,
      payment_outstanding:  pay?.outstanding ?? 0,
      has_payment:          !!pay,
    }
  })

  return { rows, total }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export async function fetchHomeVisitStats(branchId?: string): Promise<HomeVisitStatsData> {
  const supabase = await createClient()
  const viewer = await resolveViewer(supabase)
  if (!viewer) return { totalPatients: 0, activePackages: 0, visitsThisMonth: 0, noPackageYet: 0 }

  let visitQuery = supabase
    .from('patient_visits')
    .select('patient_id, visit_date')
    .in('service_type', HOME_VISIT_TYPES)

  if (isCrossBranch(viewer.role)) {
    if (branchId && branchId !== 'all') visitQuery = visitQuery.eq('branch_id', branchId)
  } else if (viewer.branchId) {
    visitQuery = visitQuery.eq('branch_id', viewer.branchId)
  } else {
    return { totalPatients: 0, activePackages: 0, visitsThisMonth: 0, noPackageYet: 0 }
  }

  const { data: visits } = await visitQuery.limit(5000)
  const patientIds = [...new Set((visits ?? []).map((v) => v.patient_id as string))]

  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)
  const visitsThisMonth = (visits ?? []).filter((v) => (v.visit_date as string) >= monthStartStr).length

  let pkgQuery = supabase
    .from('patient_packages')
    .select('patient_id', { count: 'exact' })
    .eq('category', 'PAKET VISIT')
    .eq('status', 'active')
  if (patientIds.length > 0) pkgQuery = pkgQuery.in('patient_id', patientIds)
  const { data: activePkgPatients, count: activePackages } = await pkgQuery

  const patientsWithPackage = new Set((activePkgPatients ?? []).map((p) => p.patient_id as string))
  const noPackageYet = patientIds.filter((id) => !patientsWithPackage.has(id)).length

  return {
    totalPatients:   patientIds.length,
    activePackages:  activePackages ?? 0,
    visitsThisMonth,
    noPackageYet,
  }
}

// ── Create a new home-visit session ──────────────────────────────────────────
// Shared by the "+ New Session" flow (quick booking against a service card)
// and any future detailed-entry form. Generates a fresh order_id per session
// and resolves package_id the same way jadwal.ts::createVisit does — a
// TA VISIT can never draw from a package.
export interface CreateHomeVisitSessionInput {
  patient_id: string
  branch_id: string
  attending_staff_id: string | null
  visit_date: string
  service_type: ServiceType
  shift: 'PAGI' | 'SORE' | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  regio: BodyRegion | null
  sumber_pasien: string | null
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  status: VisitStatus
  notes: string | null
  package_id: string | null
}

export async function createHomeVisitSession(
  input: CreateHomeVisitSessionInput,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { id: null, error: 'Tidak terautentikasi' }

  const orderId = await generateOrderId(supabase)
  const packageId = NO_PACKAGE_SERVICE_TYPES.has(input.service_type) ? null : input.package_id

  const { data, error } = await supabase.from('patient_visits').insert({
    patient_id:          input.patient_id,
    branch_id:           input.branch_id,
    attending_staff_id:  input.attending_staff_id ?? user.id,
    visit_date:          input.visit_date,
    service_type:        input.service_type,
    shift:                input.shift ?? null,
    kehadiran:           input.kehadiran ?? null,
    regio:               input.regio ?? null,
    sumber_pasien:       input.sumber_pasien ?? null,
    chief_complaint:     input.chief_complaint ?? null,
    diagnosis:           input.diagnosis ?? null,
    treatment:           input.treatment ?? null,
    status:              input.status,
    notes:               input.notes ?? null,
    package_id:          packageId,
    order_id:            orderId,
    updated_at:          new Date().toISOString(),
  }).select('id').single()

  if (error) return { id: null, error: error.message }

  if (data?.id) {
    await logActivity({
      supabase, userId: user.id, action: 'create', resourceType: 'patient_visit',
      resourceId: data.id, resourceLabel: input.patient_id, branchId: input.branch_id,
      newValues: {
        visit_date: input.visit_date, service_type: input.service_type,
        status: input.status, package_id: packageId,
        attending_staff_id: input.attending_staff_id ?? user.id,
      },
    })
  }

  return { id: data?.id ?? null, error: null }
}
