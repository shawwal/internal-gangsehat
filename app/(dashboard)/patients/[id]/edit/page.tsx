import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, User, Phone, Home, Stethoscope, ArrowLeft } from 'lucide-react'
import { fetchPatient } from '@/app/actions/patients'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'
import { PatientEditForm } from '@/components/patients/detail/PatientEditForm'
import { getInitials, AVATAR_BG, GENDER_LABEL } from '@/components/patients/detail/constants'

export const dynamic = 'force-dynamic'

const CAN_EDIT: UserRole[] = ['director', 'manager']

const NAV_SECTIONS = [
  { href: '#identitas', label: 'Identitas',        icon: <User size={14} /> },
  { href: '#kontak',    label: 'Informasi Kontak', icon: <Phone size={14} /> },
  { href: '#domisili',  label: 'Domisili',          icon: <Home size={14} /> },
  { href: '#medis',     label: 'Catatan Medis',     icon: <Stethoscope size={14} /> },
]

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

  const avatarBg = AVATAR_BG[patient.gender ?? 'other']

  return (
    <div className="space-y-5">

      {/* ── Breadcrumb nav ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href={`/patients/${id}`}
          aria-label="Kembali ke detail pasien"
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors duration-150 text-muted-foreground cursor-pointer"
        >
          <ChevronLeft size={16} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Pasien › {patient.name}</p>
          <h1 className="text-xl font-semibold text-foreground">Edit Data Pasien</h1>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── Left: Sticky sidebar ────────────────────────────────── */}
        <div className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-6 space-y-3">

          {/* Patient mini-card */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${avatarBg}`}>
                {getInitials(patient.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{patient.name}</p>
                <p className="text-xs text-muted-foreground">
                  {patient.gender ? GENDER_LABEL[patient.gender] : '—'}
                </p>
                {patient.no_rm && (
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{patient.no_rm}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section navigation */}
          <div className="glass-card p-2">
            <p className="text-xs font-medium text-muted-foreground px-3 py-1.5">Bagian Form</p>
            <nav aria-label="Navigasi bagian form">
              {NAV_SECTIONS.map(s => (
                <a
                  key={s.href}
                  href={s.href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer"
                >
                  <span className="text-primary">{s.icon}</span>
                  {s.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Back link — desktop convenience */}
          <Link
            href={`/patients/${id}`}
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150 cursor-pointer w-full"
          >
            <ArrowLeft size={14} />
            Kembali ke Detail
          </Link>
        </div>

        {/* ── Right: Form ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <PatientEditForm patient={patient} />
        </div>

      </div>
    </div>
  )
}
