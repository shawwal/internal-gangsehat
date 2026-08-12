'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import type { ServiceType, UserRole } from '@/types'
import type { HomeVisitPatientRow, HomeVisitPackageInfo, HomeVisitStatsData } from '@/components/homeVisit/types'

const HOME_VISIT_TYPES: ServiceType[] = ['TA VISIT', 'SESI VISIT', 'PAKET VISIT']

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

interface PkgTxRow { order_id: string; harga: number; amount: number; discount: number; status: string }

// ── Paginated list ──────────────────────────────────────────────────────────────
export async function fetchHomeVisitPatients(params: {
  search: string
  branchId?: string // 'all' or uuid — only honored for director
  page: number
  pageSize: number
}): Promise<{ rows: HomeVisitPatientRow[]; total: number }> {
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
    .select('id, patient_id, branch_id, visit_date, service_type, kehadiran, branches!branch_id(name)')
    .in('service_type', HOME_VISIT_TYPES)
    .order('visit_date', { ascending: false })

  if (isCrossBranch(viewer.role)) {
    if (params.branchId && params.branchId !== 'all') visitQuery = visitQuery.eq('branch_id', params.branchId)
  } else if (viewer.branchId) {
    visitQuery = visitQuery.eq('branch_id', viewer.branchId)
  } else {
    return { rows: [], total: 0 }
  }
  if (patientIds) visitQuery = visitQuery.in('patient_id', patientIds)

  const { data: visits } = await visitQuery.limit(5000)
  if (!visits?.length) return { rows: [], total: 0 }

  // Reduce to one row per patient — the latest home-visit visit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestByPatient = new Map<string, any>()
  for (const v of visits) {
    const existing = latestByPatient.get(v.patient_id as string)
    if (!existing || (v.visit_date as string) > (existing.visit_date as string)) {
      latestByPatient.set(v.patient_id as string, v)
    }
  }
  const uniquePatientIds = [...latestByPatient.keys()]

  // Attach PAKET VISIT package info (if any) per patient
  const pkgQuery = supabase
    .from('patient_packages_with_stats')
    .select('id, patient_id, jenis_paket, used_sessions, total_sessions, status, order_id')
    .eq('category', 'PAKET VISIT')
    .in('patient_id', uniquePatientIds)
    .order('created_at', { ascending: false })
  const { data: packages } = await pkgQuery

  const orderIds = (packages ?? []).map((p) => p.order_id).filter((v): v is string => !!v)
  const { data: pkgTxs } = orderIds.length > 0
    ? await supabase
        .from('transactions')
        .select('order_id, harga, amount, discount, status')
        .in('order_id', orderIds)
        .eq('category', 'PAKET VISIT')
        .neq('status', 'rejected')
    : { data: [] as PkgTxRow[] }

  const txByOrder = new Map<string, PkgTxRow[]>()
  for (const t of (pkgTxs ?? []) as PkgTxRow[]) {
    const list = txByOrder.get(t.order_id) ?? []
    list.push(t)
    txByOrder.set(t.order_id, list)
  }

  const packageByPatient = new Map<string, HomeVisitPackageInfo>()
  for (const p of packages ?? []) {
    if (packageByPatient.has(p.patient_id as string)) continue // keep most recent (already ordered desc)
    const rows = p.order_id ? txByOrder.get(p.order_id as string) : undefined
    let paymentStatus: 'LUNAS' | 'DP' | null = null
    let outstanding = 0
    if (rows && rows.length > 0) {
      const harga = rows[0].harga
      const amountPaid = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
      const discountTotal = rows.reduce((s, r) => s + (r.discount ?? 0), 0)
      outstanding = Math.max(harga - amountPaid - discountTotal, 0)
      paymentStatus = outstanding === 0 ? 'LUNAS' : 'DP'
    }
    packageByPatient.set(p.patient_id as string, {
      jenis_paket:    (p.jenis_paket ?? null) as HomeVisitPackageInfo['jenis_paket'],
      used_sessions:  Number(p.used_sessions ?? 0),
      total_sessions: p.total_sessions as number,
      status:         p.status as HomeVisitPackageInfo['status'],
      payment_status: paymentStatus,
      outstanding,
    })
  }

  // Batch-decrypt patient names + no_rm
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone, no_rm')
    .in('id', uniquePatientIds)

  const nameMap = new Map<string, string>()
  const rmMap   = new Map<string, string | null>()
  for (const p of patients ?? []) {
    rmMap.set(p.id, p.no_rm ?? null)
    try {
      const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
      nameMap.set(p.id, dec.name || 'Pasien')
    } catch {
      nameMap.set(p.id, 'Pasien')
    }
  }

  let rows: HomeVisitPatientRow[] = uniquePatientIds.map((pid) => {
    const v = latestByPatient.get(pid)
    return {
      patient_id:         pid,
      patient_name:       nameMap.get(pid) ?? 'Pasien',
      no_rm:              rmMap.get(pid) ?? null,
      branch_id:          v.branch_id,
      branch_name:        v.branches?.name ?? '',
      last_visit_date:    v.visit_date,
      last_service_type:  v.service_type,
      last_kehadiran:     v.kehadiran,
      package:            packageByPatient.get(pid) ?? null,
    }
  })

  rows.sort((a, b) => (a.last_visit_date < b.last_visit_date ? 1 : a.last_visit_date > b.last_visit_date ? -1 : 0))

  const total = rows.length
  const from = (params.page - 1) * params.pageSize
  rows = rows.slice(from, from + params.pageSize)

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
