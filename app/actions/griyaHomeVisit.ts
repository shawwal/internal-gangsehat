'use server'

// Home Visit Griya Anak (/griya-anak/home-visit). A home visit is a standalone
// Griya session (patient_visits, griya_slot_id NULL) with a visit service type,
// booked through griyaJadwal.addSubstitute({ kind: 'home_visit' }) so it also
// blocks the therapist's hour on the Griya jadwal. Package sessions keep the
// Griya convention service_type = 'PAKET VISIT' + package_id, which is what
// payroll counts as Paket Visit (one per package) — see lib/payroll/autoActivity.ts.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { fetchVisitDisciplines } from '@/lib/griyaDiscipline'
import { GRIYA_RECORD_EMBED, resolveGriyaRecordStates } from '@/lib/griyaRecordCompletion'
import { HOME_VISIT_SERVICE_TYPES, isPackageCategory } from '@/lib/serviceType'
import type { GriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import type { Discipline } from './griyaJadwal'

const VIEW_ROLES = ['director', 'manager', 'admin', 'therapist']

type SupaClient = Awaited<ReturnType<typeof createClient>>

async function viewer(branchId: string): Promise<{ supabase: SupaClient; userId: string; role: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile || !VIEW_ROLES.includes(profile.role)) return null
  if (profile.role !== 'director' && profile.branch_id !== branchId) return null
  const { data: griya } = await supabase.from('branch_griya_settings').select('enabled').eq('branch_id', branchId).maybeSingle()
  if (!griya?.enabled) return null
  return { supabase, userId: user.id, role: profile.role }
}

export interface GriyaHomeVisitRow {
  id: string
  patient_id: string
  patient_name: string
  patient_address: string | null
  no_rm: string | null
  visit_date: string
  visit_time: string | null
  service_type: string
  status: string
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  attending_staff_id: string | null
  therapist_name: string | null
  discipline: Discipline | null
  layanan_id: string | null
  layanan_name: string | null
  package_id: string | null
  package: { name: string; used: number; total: number; paid: boolean } | null
  /** Per-session payment (non-package visits); null = none recorded. */
  payment: { status: string | null; outstanding: number } | null
  record: { route: GriyaVisitFormRoute | null; status: 'completed' | 'draft' | null }
}

export interface GriyaHomeVisitStats {
  total: number
  hadir: number
  unpaid: number
  recordsOpen: number
}

const EMPTY_STATS: GriyaHomeVisitStats = { total: 0, hadir: 0, unpaid: 0, recordsOpen: 0 }

/** Home visits of one Griya branch in [from, to]; a therapist sees only their own. */
export async function fetchGriyaHomeVisits(params: {
  branchId: string
  from: string
  to: string
  search?: string
}): Promise<{ rows: GriyaHomeVisitRow[]; stats: GriyaHomeVisitStats }> {
  const v = await viewer(params.branchId)
  if (!v) return { rows: [], stats: EMPTY_STATS }
  const { supabase } = v

  let q = supabase
    .from('patient_visits')
    .select(`id, patient_id, branch_id, visit_date, visit_time, service_type, status, kehadiran, attending_staff_id, package_id, layanan_id, griya_slot_id, ${GRIYA_RECORD_EMBED}`)
    .eq('branch_id', params.branchId)
    .in('service_type', HOME_VISIT_SERVICE_TYPES)
    .gte('visit_date', params.from)
    .lte('visit_date', params.to)
    .order('visit_date', { ascending: false })
    .order('visit_time', { ascending: false })
  if (v.role === 'therapist') q = q.eq('attending_staff_id', v.userId)

  const search = params.search?.trim().toLowerCase()
  if (search) {
    const { data: hits } = await supabase.from('patients').select('id').ilike('name_normalized', `%${search}%`).limit(500)
    const ids = (hits ?? []).map((p) => p.id as string)
    if (ids.length === 0) return { rows: [], stats: EMPTY_STATS }
    q = q.in('patient_id', ids)
  }

  const { data, error } = await q.limit(1000)
  if (error || !data?.length) return { rows: [], stats: EMPTY_STATS }
  const visits = data as unknown as (Record<string, unknown> & {
    id: string; patient_id: string; service_type: string; attending_staff_id: string | null
    package_id: string | null; layanan_id: string | null; griya_slot_id: string | null; branch_id: string
  })[]

  const patientIds = [...new Set(visits.map((x) => x.patient_id))]
  const staffIds = [...new Set(visits.map((x) => x.attending_staff_id).filter((x): x is string => !!x))]
  const packageIds = [...new Set(visits.map((x) => x.package_id).filter((x): x is string => !!x))]
  const layananIds = [...new Set(visits.map((x) => x.layanan_id).filter((x): x is string => !!x))]
  const visitIds = visits.map((x) => x.id)

  const [patientsRes, staffRes, packagesRes, layananRes, txRes, disciplines, records] = await Promise.all([
    supabase.from('patients').select('id, encrypted_name, encrypted_phone, encrypted_address, no_rm').in('id', patientIds),
    // Therapists can only read their own internal_profiles row (RLS) — names only, via admin.
    staffIds.length
      ? createAdminClient().from('internal_profiles').select('id, full_name, nickname').in('id', staffIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; nickname: string | null }[] }),
    packageIds.length
      ? supabase.from('patient_packages_with_stats').select('id, package_name, used_sessions, total_sessions, payment_ok').in('id', packageIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    layananIds.length
      ? supabase.from('internal_layanan').select('id, nama').in('id', layananIds)
      : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
    supabase.from('transactions').select('visit_id, category, payment_status, outstanding')
      .in('visit_id', visitIds).eq('type', 'income').neq('status', 'rejected'),
    fetchVisitDisciplines(supabase, visits),
    resolveGriyaRecordStates(supabase, visits),
  ])

  const patients = new Map<string, { name: string; address: string | null; no_rm: string | null }>()
  for (const p of patientsRes.data ?? []) {
    try {
      const dec = decryptPatientPII({
        encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '',
        encrypted_address: p.encrypted_address ?? undefined,
      })
      patients.set(p.id, { name: dec.name || 'Anak', address: dec.address ?? null, no_rm: p.no_rm ?? null })
    } catch {
      patients.set(p.id, { name: 'Anak', address: null, no_rm: p.no_rm ?? null })
    }
  }
  const staff = new Map((staffRes.data ?? []).map((s) => [s.id, s.nickname?.trim() || s.full_name]))
  const packages = new Map((packagesRes.data ?? []).map((p) => [p.id as string, {
    name: (p.package_name as string) ?? 'Paket', used: Number(p.used_sessions ?? 0),
    total: Number(p.total_sessions ?? 0), paid: !!p.payment_ok,
  }]))
  const layanan = new Map((layananRes.data ?? []).map((l) => [l.id, l.nama as string]))
  // Package purchases are paid on the package, not the session.
  const payments = new Map<string, { status: string | null; outstanding: number }>()
  for (const t of txRes.data ?? []) {
    if (isPackageCategory(t.category)) continue
    const cur = payments.get(t.visit_id as string)
    const outstanding = Number(t.outstanding ?? 0)
    if (!cur || outstanding < cur.outstanding) payments.set(t.visit_id as string, { status: t.payment_status, outstanding })
  }

  const rows: GriyaHomeVisitRow[] = visits.map((x) => {
    const p = patients.get(x.patient_id)
    const rec = records.get(x.id)
    return {
      id: x.id,
      patient_id: x.patient_id,
      patient_name: p?.name ?? 'Anak',
      patient_address: p?.address ?? null,
      no_rm: p?.no_rm ?? null,
      visit_date: x.visit_date as string,
      visit_time: x.visit_time ? String(x.visit_time).slice(0, 5) : null,
      service_type: x.service_type,
      status: x.status as string,
      kehadiran: (x.kehadiran as GriyaHomeVisitRow['kehadiran']) ?? null,
      attending_staff_id: x.attending_staff_id,
      therapist_name: x.attending_staff_id ? (staff.get(x.attending_staff_id) ?? null) : null,
      discipline: (disciplines.get(x.id) as Discipline | null) ?? null,
      layanan_id: x.layanan_id,
      layanan_name: x.layanan_id ? (layanan.get(x.layanan_id) ?? null) : null,
      package_id: x.package_id,
      package: x.package_id ? (packages.get(x.package_id) ?? null) : null,
      payment: payments.get(x.id) ?? null,
      record: { route: rec?.route ?? null, status: rec?.status ?? null },
    }
  })

  const live = rows.filter((r) => r.status !== 'cancelled')
  const attended = live.filter((r) => r.kehadiran === 'HADIR')
  return {
    rows,
    stats: {
      total: live.length,
      hadir: attended.length,
      unpaid: attended.filter((r) => !r.package_id && (!r.payment || r.payment.outstanding > 0)).length,
      recordsOpen: attended.filter((r) => r.record.route && r.record.status !== 'completed').length,
    },
  }
}

export interface GriyaHomeVisitTherapist {
  id: string
  name: string
  discipline: Discipline
}

/** Active Griya roster — who can be sent on a home visit. */
export async function fetchGriyaHomeVisitTherapists(branchId: string): Promise<GriyaHomeVisitTherapist[]> {
  const v = await viewer(branchId)
  if (!v) return []
  const { data: roster } = await v.supabase
    .from('griya_therapists')
    .select('therapist_id, discipline, display_order')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('display_order')
  const ids = (roster ?? []).map((r) => r.therapist_id as string)
  if (ids.length === 0) return []
  const { data: profiles } = await createAdminClient()
    .from('internal_profiles').select('id, full_name, nickname, is_active').in('id', ids)
  const byId = new Map((profiles ?? []).filter((p) => p.is_active !== false).map((p) => [p.id, p.nickname?.trim() || p.full_name]))
  return (roster ?? [])
    .filter((r) => byId.has(r.therapist_id as string))
    .map((r) => ({ id: r.therapist_id as string, name: byId.get(r.therapist_id as string)!, discipline: r.discipline as Discipline }))
}
