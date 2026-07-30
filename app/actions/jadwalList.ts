'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { calcAge } from '@/components/patients/detail/constants'
import { getVisitFormRoute, isRegioRequired } from '@/lib/visitRouting'

export type AdminStatus = 'BELUM_DIPERIKSA' | 'BELUM_DITANGANI' | 'LENGKAP'

export interface JadwalListRow {
  id: string
  visit_date: string
  visit_time: string | null
  patient_id: string
  patient_name: string
  patient_phone: string
  patient_age: string | null
  chief_complaint: string | null
  attending_staff_name: string | null
  service_type: string | null
  pertemuan_ke: number
  kurang_bayar: number
  kehadiran: string | null
  admin_status: AdminStatus
  notes: string | null
  order_id: string | null
  branch_id: string
}

function deriveAdminStatus(v: {
  diagnosis: string | null
  treatment: string | null
  regio: string | null
  service_type: string | null
}): AdminStatus {
  const complete = !!v.diagnosis && !!v.treatment && (!isRegioRequired(v.service_type) || !!v.regio)
  if (complete) return 'LENGKAP'
  return getVisitFormRoute(v.service_type) === 'assessment' ? 'BELUM_DIPERIKSA' : 'BELUM_DITANGANI'
}

export async function fetchJadwalListRows(date: string, branchId?: string | null): Promise<JadwalListRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('patient_visits')
    .select(`
      id, patient_id, branch_id, visit_date, visit_time, service_type, package_id, order_id,
      chief_complaint, diagnosis, treatment, regio, kehadiran, status, notes, attending_staff_id,
      internal_profiles!attending_staff_id(full_name, nickname)
    `)
    .eq('visit_date', date)
    .order('visit_time', { ascending: true })
  if (branchId) query = query.eq('branch_id', branchId)

  const { data: visits, error } = await query
  if (error || !visits || visits.length === 0) return []

  // Batch-decrypt patient name/phone/birth date for just this day's patients.
  const patientIds = [...new Set(visits.map((v) => v.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone, encrypted_birth_date')
    .in('id', patientIds)

  const nameMap = new Map<string, string>()
  const phoneMap = new Map<string, string>()
  const ageMap = new Map<string, string | null>()
  for (const p of patients ?? []) {
    try {
      const dec = decryptPatientPII({
        encrypted_name:       p.encrypted_name ?? '',
        encrypted_phone:      p.encrypted_phone ?? '',
        encrypted_birth_date: p.encrypted_birth_date ?? undefined,
      })
      nameMap.set(p.id, dec.name || 'Pasien')
      phoneMap.set(p.id, dec.phone || '')
      ageMap.set(p.id, dec.birthDate ? calcAge(dec.birthDate) : null)
    } catch {
      nameMap.set(p.id, 'Pasien')
      phoneMap.set(p.id, '')
      ageMap.set(p.id, null)
    }
  }

  // Batch-sum outstanding across all non-rejected transactions per visit.
  const visitIds = visits.map((v) => v.id)
  const { data: txns } = await supabase
    .from('transactions')
    .select('visit_id, outstanding, status')
    .in('visit_id', visitIds)
    .neq('status', 'rejected')

  const outstandingMap = new Map<string, number>()
  for (const t of txns ?? []) {
    const vid = t.visit_id as string
    outstandingMap.set(vid, (outstandingMap.get(vid) ?? 0) + (t.outstanding ?? 0))
  }

  // Pertemuan ke — ordinal rank of this visit among all visits sharing its package_id.
  const packageIds = [...new Set(visits.map((v) => v.package_id).filter((id): id is string => !!id))]
  const pertemuanMap = new Map<string, number>()
  if (packageIds.length > 0) {
    const { data: pkgVisits } = await supabase
      .from('patient_visits')
      .select('id, package_id, visit_date, visit_time, status')
      .in('package_id', packageIds)
      .neq('status', 'cancelled')
    const byPackage = new Map<string, { id: string; visit_date: string; visit_time: string | null }[]>()
    for (const v of pkgVisits ?? []) {
      const pid = v.package_id as string
      const list = byPackage.get(pid) ?? []
      list.push({ id: v.id, visit_date: v.visit_date, visit_time: v.visit_time })
      byPackage.set(pid, list)
    }
    for (const [, list] of byPackage) {
      list.sort((a, b) => {
        const da = `${a.visit_date} ${a.visit_time ?? '00:00'}`
        const db = `${b.visit_date} ${b.visit_time ?? '00:00'}`
        return da.localeCompare(db)
      })
      list.forEach((v, i) => pertemuanMap.set(v.id, i + 1))
    }
  }

  return visits.map((v) => {
    const staff = v.internal_profiles as unknown as { full_name: string; nickname: string | null } | null
    return {
      id:                    v.id,
      visit_date:            v.visit_date,
      visit_time:            v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      patient_id:            v.patient_id,
      patient_name:          nameMap.get(v.patient_id) ?? 'Pasien',
      patient_phone:         phoneMap.get(v.patient_id) ?? '',
      patient_age:           ageMap.get(v.patient_id) ?? null,
      chief_complaint:       v.chief_complaint,
      attending_staff_name:  staff?.nickname || staff?.full_name || null,
      service_type:          v.service_type,
      pertemuan_ke:          v.package_id ? (pertemuanMap.get(v.id) ?? 1) : 1,
      kurang_bayar:          outstandingMap.get(v.id) ?? 0,
      kehadiran:             v.kehadiran,
      admin_status:          deriveAdminStatus(v),
      notes:                 v.notes,
      order_id:              v.order_id,
      branch_id:             v.branch_id,
    }
  })
}
