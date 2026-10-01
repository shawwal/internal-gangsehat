'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { calcAge } from '@/components/patients/detail/constants'
import { SERVICE_TYPE_LABEL } from '@/components/jadwal/types'
import { deriveAdminStatus, fetchLatestComplaints, fetchPackagePositions, type AdminStatus } from '@/lib/internal/visitInsights'

export type { AdminStatus }

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
  // Display label — same rule as the jadwal-harian VisitCard (package_id wins → 'Paket')
  layanan_label: string | null
  pertemuan_ke: number
  kurang_bayar: number
  kehadiran: string | null
  admin_status: AdminStatus
  notes: string | null
  order_id: string | null
  branch_id: string
}

export async function fetchJadwalListRows(date: string, branchId?: string | null): Promise<JadwalListRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('patient_visits')
    .select(`
      id, patient_id, branch_id, visit_date, visit_time, service_type, package_id, order_id, layanan_id,
      chief_complaint, diagnosis, treatment, regio, kehadiran, status, notes, attending_staff_id,
      internal_profiles!attending_staff_id(full_name, nickname)
    `)
    .eq('visit_date', date)
    // Same service types as the jadwal-harian grid — Sport Massage has its own schedule page.
    .in('service_type', ['TERAPI AWAL', 'PAKET TERAPI', 'SESI TERAPI', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA'])
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

  // Pertemuan ke (incl. legacy sessions) and the patient's latest complaint —
  // complaints follow the patient, so repeat visits under a new order still show one.
  const packageIds = [...new Set(visits.map((v) => v.package_id).filter((id): id is string => !!id))]
  const [packagePositions, latestComplaints, assessments, sessionNotes, griyaIntakes, griyaNotes] = await Promise.all([
    fetchPackagePositions(supabase, packageIds),
    fetchLatestComplaints(supabase, patientIds),
    supabase.from('terapi_awal_assessments').select('visit_id, status').in('visit_id', visitIds),
    supabase.from('session_notes').select('visit_id, status').in('visit_id', visitIds),
    supabase.from('griya_terapi_awal').select('visit_id, status').in('visit_id', visitIds),
    supabase.from('griya_session_notes').select('visit_id, status').in('visit_id', visitIds),
  ])

  const layananIds = [...new Set(visits.map((v) => v.layanan_id).filter((id): id is string => !!id))]
  const layananNameMap = new Map<string, string>()
  if (layananIds.length > 0) {
    const { data: layanan } = await supabase.from('internal_layanan').select('id, nama').in('id', layananIds)
    for (const l of layanan ?? []) layananNameMap.set(l.id, l.nama)
  }

  // Record-form status per visit; 'completed' wins if a visit has more than one row.
  const formStatusMap = new Map<string, string>()
  for (const r of [
    ...(assessments.data ?? []), ...(sessionNotes.data ?? []),
    ...(griyaIntakes.data ?? []), ...(griyaNotes.data ?? []),
  ]) {
    const vid = r.visit_id as string
    if (formStatusMap.get(vid) !== 'completed') formStatusMap.set(vid, r.status as string)
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
      chief_complaint:       v.chief_complaint?.trim() || latestComplaints.get(v.patient_id) || null,
      attending_staff_name:  staff?.nickname || staff?.full_name || null,
      service_type:          v.service_type,
      layanan_label:         v.package_id
        ? 'Paket'
        : ((v.layanan_id ? layananNameMap.get(v.layanan_id) : undefined)
          ?? (v.service_type ? SERVICE_TYPE_LABEL[v.service_type] ?? v.service_type : null)),
      pertemuan_ke:          v.package_id ? (packagePositions.get(v.id)?.pertemuan ?? 1) : 1,
      kurang_bayar:          outstandingMap.get(v.id) ?? 0,
      kehadiran:             v.kehadiran,
      admin_status:          deriveAdminStatus(v, formStatusMap.get(v.id)),
      notes:                 v.notes,
      order_id:              v.order_id,
      branch_id:             v.branch_id,
    }
  })
}
