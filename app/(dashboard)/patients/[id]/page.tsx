import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, BadgeCheck } from 'lucide-react'
import { fetchPatient } from '@/app/actions/patients'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'
import { PatientHero } from '@/components/patients/detail/PatientHero'
import { PatientInfoSections } from '@/components/patients/detail/PatientInfoSections'
import { PatientVisitHistory } from '@/components/patients/detail/PatientVisitHistory'

export const dynamic = 'force-dynamic'

const CAN_EDIT: UserRole[] = ['director', 'manager']

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [patient, { data: { user } }] = await Promise.all([
    fetchPatient(id),
    supabase.auth.getUser(),
  ])

  if (!patient) notFound()

  const [{ data: profile }, { data: visits }, { count: totalVisits }] = await Promise.all([
    supabase.from('internal_profiles').select('role').eq('id', user?.id ?? '').single(),
    supabase
      .from('patient_visits')
      .select('id, visit_date, service_type, status, chief_complaint, shift, kehadiran')
      .eq('patient_id', id)
      .order('visit_date', { ascending: false })
      .limit(5),
    supabase
      .from('patient_visits')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', id),
  ])

  const canEdit = CAN_EDIT.includes(profile?.role as UserRole)

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/patients"
          aria-label="Kembali ke daftar pasien"
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors duration-150 text-muted-foreground cursor-pointer"
        >
          <ChevronLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Pasien</p>
          <h1 className="text-xl font-semibold text-foreground truncate">{patient.name}</h1>
        </div>
        {patient.isActive ? (
          <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-chart-4/15 text-chart-4 shrink-0">
            <BadgeCheck size={12} /> Aktif
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
            Tidak Aktif
          </span>
        )}
      </div>

      <PatientHero patient={patient} totalVisits={totalVisits ?? 0} canEdit={canEdit} />
      <PatientInfoSections patient={patient} />
      <PatientVisitHistory visits={visits ?? []} totalVisits={totalVisits ?? 0} patientId={id} />
    </div>
  )
}
