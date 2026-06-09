import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { fetchPatient } from '@/app/actions/patients'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'
import { PatientEditForm } from '@/components/patients/detail/PatientEditForm'

export const dynamic = 'force-dynamic'

const CAN_EDIT: UserRole[] = ['director', 'manager']

export default async function PatientEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [patient, { data: { user } }] = await Promise.all([
    fetchPatient(id),
    supabase.auth.getUser(),
  ])

  if (!patient) notFound()

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (!CAN_EDIT.includes(profile?.role as UserRole)) {
    redirect(`/patients/${id}`)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/patients/${id}`}
          aria-label="Kembali ke detail pasien"
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors duration-150 text-muted-foreground cursor-pointer"
        >
          <ChevronLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            Pasien &rsaquo; {patient.name}
          </p>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Pencil size={16} className="text-primary shrink-0" />
            Edit Data Pasien
          </h1>
        </div>
      </div>

      <PatientEditForm patient={patient} />
    </div>
  )
}
