import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ClipboardList, Phone, MapPin, Droplets,
  AlertTriangle, Stethoscope, Briefcase, BookOpen,
  Home, HeartPulse, BadgeCheck, ShieldAlert, User,
  CalendarDays, Hash, Clock,
} from 'lucide-react'
import { fetchPatient } from '@/app/actions/patients'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const GENDER_LABEL: Record<string, string> = {
  male: 'Laki-laki', female: 'Perempuan', other: 'Lainnya',
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-secondary/20 text-secondary-foreground',
  completed:  'bg-chart-4/15 text-chart-4',
  cancelled:  'bg-destructive/10 text-destructive',
  no_show:    'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Terjadwal',
  completed:  'Selesai',
  cancelled:  'Dibatalkan',
  no_show:    'Tidak Hadir',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return '—'
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return `${age} tahun`
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_BG: Record<string, string> = {
  male:   'bg-blue-500/20 text-blue-600',
  female: 'bg-primary/20 text-primary',
  other:  'bg-secondary/20 text-secondary-foreground',
}

function InfoRow({ label, value, icon }: { label: string; value: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border/40 last:border-0">
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <dt className="w-36 text-xs text-muted-foreground shrink-0 leading-5">{label}</dt>
      <dd className="text-sm text-foreground break-words flex-1">{value ?? '—'}</dd>
    </div>
  )
}

function SectionCard({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="glass-card p-5 space-y-1">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <dl className="space-y-0">
        {children}
      </dl>
    </div>
  )
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const patient = await fetchPatient(id)
  if (!patient) notFound()

  const supabase = await createClient()
  const { data: visits } = await supabase
    .from('patient_visits')
    .select('id, visit_date, service_type, status, chief_complaint, shift, kehadiran')
    .eq('patient_id', id)
    .order('visit_date', { ascending: false })
    .limit(5)

  const { count: totalVisits } = await supabase
    .from('patient_visits')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', id)

  const domisili = [
    patient.kelurahan,
    patient.kecamatan,
    patient.kabupaten_kota,
    patient.provinsi,
  ].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          href="/patients"
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
          aria-label="Kembali ke daftar pasien"
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
          <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
            Tidak Aktif
          </span>
        )}
      </div>

      {/* Hero profile card */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${
            AVATAR_BG[patient.gender ?? 'other']
          }`}>
            {getInitials(patient.name)}
          </div>

          {/* Name + key facts */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-lg font-bold text-foreground">{patient.name}</p>
              <p className="text-sm text-muted-foreground">
                {patient.gender ? GENDER_LABEL[patient.gender] : '—'}
                {patient.birthDate && ` · ${calcAge(patient.birthDate)}`}
              </p>
            </div>

            {/* Quick badge row */}
            <div className="flex flex-wrap gap-2">
              {patient.no_rm && (
                <span className="flex items-center gap-1 text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                  <Hash size={10} /> {patient.no_rm}
                </span>
              )}
              {patient.blood_type && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive">
                  <Droplets size={10} /> {patient.blood_type}
                </span>
              )}
              {patient.agama && (
                <span className="text-xs bg-secondary/15 text-secondary-foreground px-2 py-0.5 rounded-md">
                  {patient.agama}
                </span>
              )}
              {patient.pekerjaan && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                  {patient.pekerjaan}
                </span>
              )}
            </div>
          </div>

          {/* Visit count */}
          <div className="text-center shrink-0">
            <p className="text-2xl font-bold text-foreground leading-none">{totalVisits ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Kunjungan</p>
          </div>
        </div>

        {/* Meta timestamps */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/50">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={11} /> Daftar: {formatDateTime(patient.createdAt)}
          </span>
          {patient.updatedAt && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={11} /> Update: {formatDateTime(patient.updatedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kontak */}
        <SectionCard title="Informasi Kontak" icon={<Phone size={15} />}>
          <InfoRow label="No. Telepon"   value={patient.phone}            icon={<Phone size={13} />} />
          <InfoRow label="Alamat"        value={patient.address}          icon={<MapPin size={13} />} />
          <InfoRow label="No. KTP / NIK" value={patient.idNumber}        icon={<User size={13} />} />
          <InfoRow label="Kont. Darurat" value={patient.emergencyContact} icon={<ShieldAlert size={13} />} />
        </SectionCard>

        {/* Data Diri */}
        <SectionCard title="Data Diri" icon={<User size={15} />}>
          <InfoRow label="Tanggal Lahir" value={formatDate(patient.birthDate)} icon={<CalendarDays size={13} />} />
          <InfoRow label="Usia"          value={calcAge(patient.birthDate)}     icon={<CalendarDays size={13} />} />
          <InfoRow label="Jenis Kelamin" value={patient.gender ? GENDER_LABEL[patient.gender] : null} />
          <InfoRow label="Golongan Darah" value={patient.blood_type}           icon={<Droplets size={13} />} />
          <InfoRow label="Agama"         value={patient.agama}                 icon={<BookOpen size={13} />} />
          <InfoRow label="Pekerjaan"     value={patient.pekerjaan}             icon={<Briefcase size={13} />} />
          <InfoRow label="Hobi"          value={patient.hobi} />
        </SectionCard>

        {/* Domisili */}
        <SectionCard title="Domisili" icon={<Home size={15} />}>
          <InfoRow label="Kelurahan"     value={patient.kelurahan} />
          <InfoRow label="Kecamatan"     value={patient.kecamatan} />
          <InfoRow label="Kabupaten/Kota" value={patient.kabupaten_kota} icon={<MapPin size={13} />} />
          <InfoRow label="Provinsi"      value={patient.provinsi} />
          {domisili && (
            <div className="pt-2 mt-1">
              <p className="text-xs text-muted-foreground">Alamat Lengkap</p>
              <p className="text-sm text-foreground mt-0.5">{domisili}</p>
            </div>
          )}
        </SectionCard>

        {/* Medis */}
        <SectionCard title="Catatan Medis" icon={<Stethoscope size={15} />}>
          <InfoRow
            label="Alergi"
            value={patient.allergies}
            icon={<AlertTriangle size={13} />}
          />
          {patient.allergies && (
            <div className="mt-1 mb-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20 text-xs text-destructive">
              Perhatian: Pasien memiliki riwayat alergi.
            </div>
          )}
          <InfoRow label="Catatan Medis" value={patient.medical_notes} icon={<HeartPulse size={13} />} />
        </SectionCard>
      </div>

      {/* Visit history */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="text-primary"><ClipboardList size={15} /></span>
            Riwayat Kunjungan
            {(totalVisits ?? 0) > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({totalVisits} total)
              </span>
            )}
          </h2>
          <Link
            href={`/patients/${id}/visits`}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
          >
            <ClipboardList size={12} /> Lihat Semua
          </Link>
        </div>

        {!visits?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada kunjungan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Riwayat kunjungan">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Tanggal</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 hidden sm:table-cell">Layanan</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 hidden md:table-cell">Shift</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4 hidden md:table-cell">Kehadiran</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v, i) => (
                  <tr
                    key={v.id}
                    className={`${i !== visits.length - 1 ? 'border-b border-border/40' : ''}`}
                  >
                    <td className="py-2.5 pr-4">
                      <p className="text-sm font-medium text-foreground">{v.visit_date}</p>
                      {v.chief_complaint && (
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{v.chief_complaint}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{v.service_type ?? '—'}</span>
                    </td>
                    <td className="py-2.5 pr-4 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{v.shift ?? '—'}</span>
                    </td>
                    <td className="py-2.5 pr-4 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.kehadiran === 'HADIR'
                          ? 'bg-chart-4/15 text-chart-4'
                          : v.kehadiran === 'TIDAK HADIR'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {v.kehadiran ?? '—'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        STATUS_BADGE[v.status] ?? 'bg-muted text-muted-foreground'
                      }`}>
                        {STATUS_LABEL[v.status] ?? v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
