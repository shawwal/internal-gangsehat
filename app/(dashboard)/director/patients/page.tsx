import { createClient } from '@/lib/supabase/server'
import { fetchPatients } from '@/app/actions/patients'
import PatientAnalyticsClient from '@/components/patients/analytics/PatientAnalyticsClient'
import type { PatientAnalyticsSummary, VisitAnalyticsSummary } from '@/components/patients/analytics/PatientAnalyticsClient'

export const dynamic = 'force-dynamic'

export default async function PatientAnalyticsPage() {
  const supabase = await createClient()

  const [allPatients, visitsResult] = await Promise.all([
    fetchPatients(),
    supabase
      .from('patient_visits')
      .select('patient_id, visit_date, service_type, status'),
  ])

  // Map to lightweight analytics-safe objects — no PII besides birth year
  const patients: PatientAnalyticsSummary[] = allPatients.map(p => ({
    id:        p.id,
    gender:    p.gender,
    birthYear: p.birthDate ? new Date(p.birthDate).getFullYear() : null,
    createdAt: p.createdAt,
    isActive:  p.isActive,
    agama:     p.agama,
    provinsi:  p.provinsi,
  }))

  const visits: VisitAnalyticsSummary[] = (visitsResult.data ?? []).map(v => ({
    patientId:   v.patient_id,
    visitDate:   v.visit_date,
    serviceType: v.service_type,
    status:      v.status,
  }))

  return <PatientAnalyticsClient patients={patients} visits={visits} />
}
