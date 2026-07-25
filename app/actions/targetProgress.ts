'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { VISIT_STATUS_FILTER } from '@/components/performance/utils'
import type { CategoryKey } from '@/components/targetProgress/types'

const TA_TYPES = ['TERAPI AWAL', 'TA VISIT']

export interface TargetProgressDetailRow {
  id: string
  patientName: string
  serviceType: string | null
  visitTime: string | null
  fisioName: string
}

export async function fetchTargetProgressDetail(
  branchId: string,
  visitDate: string,
  category: CategoryKey,
): Promise<TargetProgressDetailRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('patient_visits')
    .select('id, patient_id, visit_time, service_type, internal_profiles!attending_staff_id(full_name)')
    .eq('branch_id', branchId)
    .eq('visit_date', visitDate)
    .eq('kehadiran', 'HADIR')
    .in('status', [...VISIT_STATUS_FILTER])

  if (category === 'ta') query = query.in('service_type', TA_TYPES)
  else if (category === 'paket_klinik') query = query.eq('service_type', 'PAKET TERAPI')
  else if (category === 'paket_visit') query = query.eq('service_type', 'PAKET VISIT')

  const { data, error } = await query.order('visit_time', { ascending: true, nullsFirst: false })
  if (error || !data) return []

  // patient_visits has no FK relationship registered for `patient_id` in the
  // PostgREST schema cache, so `patients!patient_id(...)` embedding silently
  // returns 0 rows — fetch patients separately instead (two-step, per CLAUDE.md).
  const patientIds = [...new Set(data.map((row) => row.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name')
    .in('id', patientIds)
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => {
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
