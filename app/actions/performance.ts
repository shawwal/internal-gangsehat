'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { VISIT_STATUS_FILTER, isAttended } from '@/components/performance/utils'

export interface TerapisPatientVisitRow {
  id: string
  patientName: string
  visitDate: string
  serviceType: string | null
}

/** Attended visits behind one therapist's leaderboard "Total" number —
 *  same status/attendance filter as TerapisTerbaikTab's aggregation, so the
 *  drill-down list always matches the count shown. */
export async function fetchTerapisTerbaikPatients(
  staffId: string,
  start: string,
  end: string,
  branchFilter: string,
): Promise<TerapisPatientVisitRow[]> {
  const supabase = await createClient()

  let q = supabase
    .from('patient_visits')
    .select('id, patient_id, visit_date, kehadiran, service_type')
    .eq('attending_staff_id', staffId)
    .gte('visit_date', start)
    .lte('visit_date', end)
    .in('status', [...VISIT_STATUS_FILTER])
  if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)

  const { data, error } = await q
  if (error || !data) return []

  const visits = data as { id: string; patient_id: string; visit_date: string; kehadiran: 'HADIR' | 'TIDAK HADIR' | null; service_type: string | null }[]
  const rows = visits.filter((v) => isAttended(v))
  rows.sort((a, b) => a.visit_date.localeCompare(b.visit_date))

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
      patientName: name || '—',
      visitDate: row.visit_date,
      serviceType: row.service_type,
    }
  })
}
