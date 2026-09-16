'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'

export interface GriyaTherapistVisitRow {
  id: string
  patientId: string
  patientName: string
  visitDate: string
  visitTime: string | null
  serviceType: string | null
}

/** Attended (kehadiran='HADIR') visits for one Griya Anak therapist in a date
 *  range — the drill-down behind a leaderboard "total sessions" number. */
export async function fetchGriyaTherapistVisits(
  branchId: string,
  attendingStaffId: string,
  from: string,
  to: string,
): Promise<GriyaTherapistVisitRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_visits')
    .select('id, patient_id, visit_date, visit_time, service_type')
    .eq('branch_id', branchId)
    .eq('attending_staff_id', attendingStaffId)
    .eq('kehadiran', 'HADIR')
    .gte('visit_date', from)
    .lte('visit_date', to)

  if (error || !data) return []

  const rows = data as { id: string; patient_id: string; visit_date: string; visit_time: string | null; service_type: string | null }[]
  rows.sort((a, b) => a.visit_date.localeCompare(b.visit_date) || (a.visit_time ?? '').localeCompare(b.visit_time ?? ''))

  // patient_visits has no FK relationship registered for `patient_id` in the
  // PostgREST schema cache, so embedding `patients!patient_id(...)` silently
  // returns 0 rows — fetch patients separately instead (two-step, per CLAUDE.md).
  const patientIds = [...new Set(rows.map((r) => r.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name')
    .in('id', patientIds)
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

  return rows.map((row) => {
    const encName = nameById.get(row.patient_id) ?? ''
    const name = encName ? decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name : '—'
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: name || '—',
      visitDate: row.visit_date,
      visitTime: row.visit_time,
      serviceType: row.service_type,
    }
  })
}
