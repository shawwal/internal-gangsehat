'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { VISIT_STATUS_FILTER, isAttended, firstPackageVisits } from '@/components/performance/utils'
import type { CategoryKey } from '@/components/targetProgress/types'

const TA_TYPES = ['TERAPI AWAL', 'TA VISIT']

export interface TargetProgressDetailRow {
  id: string
  patientName: string
  serviceType: string | null
  visitTime: string | null
  fisioName: string
}

interface VisitRow {
  id: string
  patient_id: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  package_id: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internal_profiles: any
}

export async function fetchTargetProgressDetail(
  branchId: string,
  visitDate: string,
  category: CategoryKey,
  todayISO: string,
): Promise<TargetProgressDetailRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('patient_visits')
    .select(
      'id, patient_id, visit_date, visit_time, service_type, kehadiran, package_id, ' +
      'internal_profiles!attending_staff_id(full_name)',
    )
    .eq('branch_id', branchId)
    .in('status', [...VISIT_STATUS_FILTER])

  if (category === 'ta') query = query.in('service_type', TA_TYPES).eq('visit_date', visitDate)
  else if (category === 'kunjungan') query = query.eq('visit_date', visitDate)
  else if (category === 'paket_klinik') query = query.eq('service_type', 'PAKET TERAPI')
  else if (category === 'paket_visit') query = query.eq('service_type', 'PAKET VISIT')

  const { data, error } = await query
  if (error || !data) return []

  const attended = (data as unknown as VisitRow[]).filter((v) => isAttended(v, todayISO))
  let rows: VisitRow[]

  if (category === 'paket_klinik' || category === 'paket_visit') {
    // Day-cell counts one row per package — on the date of its earliest
    // attended session — so the detail view must show exactly those rows,
    // not every session of every package touching this date.
    rows = firstPackageVisits(attended).filter((v) => v.visit_date === visitDate)
  } else {
    rows = attended
  }

  rows.sort((a, b) => (a.visit_time ?? '').localeCompare(b.visit_time ?? ''))

  // patient_visits has no FK relationship registered for `patient_id` in the
  // PostgREST schema cache, so `patients!patient_id(...)` embedding silently
  // returns 0 rows — fetch patients separately instead (two-step, per CLAUDE.md).
  const patientIds = [...new Set(rows.map((row) => row.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name')
    .in('id', patientIds)
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

  return rows.map((row) => {
    const encName = nameById.get(row.patient_id) ?? ''
    const name = encName
      ? decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name
      : '—'
    return {
      id: row.id,
      patientName: name || '—',
      serviceType: row.service_type,
      visitTime: row.visit_time,
      fisioName: row.internal_profiles?.full_name ?? '—',
    }
  })
}
