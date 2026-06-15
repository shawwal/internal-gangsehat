import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, BadgeCheck, Package, ChevronRight } from 'lucide-react'
import { fetchPatient } from '@/app/actions/patients'
import { fetchPatientPackages } from '@/app/actions/packages'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, PatientPackage } from '@/types'
import { PatientHero } from '@/components/patients/detail/PatientHero'
import { PatientInfoSections } from '@/components/patients/detail/PatientInfoSections'
import { PatientVisitHistory } from '@/components/patients/detail/PatientVisitHistory'

export const dynamic = 'force-dynamic'

const CAN_EDIT: UserRole[] = ['director', 'manager']

function SessionBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const remaining = total - used
  const barColor = remaining === 0 ? 'bg-destructive' : remaining <= 2 ? 'bg-[#FFB35C]' : 'bg-[#34C759]'
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-[10px] font-medium ${remaining === 0 ? 'text-destructive' : remaining <= 2 ? 'text-[#FFB35C]' : 'text-[#34C759]'}`}>
        {remaining} sesi tersisa
      </p>
    </div>
  )
}

function PatientPackagesSummary({ packages, patientId }: { packages: PatientPackage[]; patientId: string }) {
  const active = packages.filter((p) => p.status === 'active')

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Paket Aktif</span>
          {active.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {active.length}
            </span>
          )}
        </div>
        <Link
          href={`/patients/${patientId}/packages`}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          Lihat semua <ChevronRight size={12} />
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada paket aktif</p>
          <Link
            href={`/patients/${patientId}/packages`}
            className="text-xs text-primary hover:underline"
          >
            + Tambah paket
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {active.slice(0, 3).map((pkg) => (
            <div key={pkg.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium text-foreground truncate">{pkg.package_name}</span>
                  {pkg.jenis_paket && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                      {pkg.jenis_paket}
                    </span>
                  )}
                </div>
                <SessionBar used={pkg.used_sessions} total={pkg.total_sessions} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{pkg.used_sessions}/{pkg.total_sessions}</p>
                <p className="text-[10px] text-muted-foreground/60">sesi</p>
              </div>
            </div>
          ))}
          {active.length > 3 && (
            <div className="px-5 py-3 text-center">
              <Link href={`/patients/${patientId}/packages`} className="text-xs text-primary hover:underline">
                +{active.length - 3} paket lainnya
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [patient, { data: { user } }] = await Promise.all([
    fetchPatient(id),
    supabase.auth.getUser(),
  ])

  if (!patient) notFound()

  const [{ data: profile }, { data: visits }, { count: totalVisits }, packages] = await Promise.all([
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
    fetchPatientPackages(id),
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
      <PatientPackagesSummary packages={packages} patientId={id} />
      <PatientVisitHistory visits={visits ?? []} totalVisits={totalVisits ?? 0} patientId={id} />
    </div>
  )
}
