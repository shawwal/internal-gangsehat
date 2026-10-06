'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'

export interface SportMassageTherapistVisitRow {
  id: string
  patientId: string
  patientName: string
  visitDate: string
  visitTime: string | null
  regio: string | null
}

/** Attended (kehadiran='HADIR') SPORT MASSAGE visits for one therapist in a
 *  date range — the drill-down behind a leaderboard "total sessions" number. */
export async function fetchSportMassageTherapistVisits(
  branchId: string,
  attendingStaffId: string,
  from: string,
  to: string,
): Promise<SportMassageTherapistVisitRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_visits')
    .select('id, patient_id, visit_date, visit_time, regio')
    .eq('branch_id', branchId)
    .eq('attending_staff_id', attendingStaffId)
    .eq('service_type', 'SPORT MASSAGE')
    .eq('kehadiran', 'HADIR')
    .gte('visit_date', from)
    .lte('visit_date', to)

  if (error || !data) return []

  const rows = data as { id: string; patient_id: string; visit_date: string; visit_time: string | null; regio: string | null }[]
  rows.sort((a, b) => a.visit_date.localeCompare(b.visit_date) || (a.visit_time ?? '').localeCompare(b.visit_time ?? ''))

  // No PostgREST FK for `patient_id` — fetch patients separately (see griyaPerforma.ts).
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
      regio: row.regio,
    }
  })
}
