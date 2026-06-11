import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchPatients } from '@/app/actions/patients'
import PatientAnalyticsClient from '@/components/patients/analytics/PatientAnalyticsClient'
import type { PatientAnalyticsSummary, VisitAnalyticsSummary } from '@/components/patients/analytics/PatientAnalyticsClient'

export const dynamic = 'force-dynamic'

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Period badge + count */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-28 bg-muted rounded-2xl animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card h-24 animate-pulse rounded-3xl" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card h-72 animate-pulse rounded-3xl" />
        <div className="glass-card h-72 animate-pulse rounded-3xl" />
      </div>
      <div className="glass-card h-64 animate-pulse rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card h-64 animate-pulse rounded-3xl" />
        <div className="glass-card h-64 animate-pulse rounded-3xl" />
      </div>
    </div>
  )
}

// ─── Data loader (async, streams in behind Suspense) ──────────────────────────

async function AnalyticsData() {
  const supabase = await createClient()

  const [allPatients, visitsResult] = await Promise.all([
    fetchPatients(),
    supabase
      .from('patient_visits')
      .select('patient_id, visit_date, service_type, status'),
  ])

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

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function PatientAnalyticsPage() {
  return (
    <div className="space-y-6 relative">
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header — renders immediately, no data needed */}
      <div className="flex items-center gap-3">
        <Link
          href="/director/overview"
          className="w-9 h-9 rounded-2xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Kembali ke overview"
        >
          <ArrowLeft size={16} className="text-foreground/70" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Analitik Pasien</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Infografis &amp; statistik demografi pasien</p>
        </div>
      </div>

      {/* Analytics streams in — skeleton shows while data loads */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsData />
      </Suspense>
    </div>
  )
}
