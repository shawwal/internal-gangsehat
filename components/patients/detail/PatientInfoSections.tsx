import {
  AlertTriangle, BookOpen, Briefcase, CalendarDays,
  Droplets, HeartPulse, Home, MapPin, PersonStanding, Phone,
  ShieldAlert, Smile, Stethoscope, User,
} from 'lucide-react'
import type { PatientPlain } from '@/app/actions/patients'
import { GENDER_LABEL, calcAge, formatDate } from './constants'
import { InfoRow } from './InfoRow'
import { SectionCard } from './SectionCard'

interface PatientInfoSectionsProps {
  patient: PatientPlain
}

export function PatientInfoSections({ patient }: PatientInfoSectionsProps) {
  const domisili = [
    patient.kelurahan,
    patient.kecamatan,
    patient.kabupaten_kota,
    patient.provinsi,
  ].filter(Boolean).join(', ')

  return (
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
        <InfoRow label="Tanggal Lahir"  value={formatDate(patient.birthDate)}                       icon={<CalendarDays size={13} />} />
        <InfoRow label="Usia"           value={calcAge(patient.birthDate)}                          icon={<CalendarDays size={13} />} />
        <InfoRow label="Jenis Kelamin"  value={patient.gender ? GENDER_LABEL[patient.gender] : null} icon={<PersonStanding size={13} />} />
        <InfoRow label="Gol. Darah"     value={patient.blood_type}                                  icon={<Droplets size={13} />} />
        <InfoRow label="Agama"          value={patient.agama}                                       icon={<BookOpen size={13} />} />
        <InfoRow label="Pekerjaan"      value={patient.pekerjaan}                                   icon={<Briefcase size={13} />} />
        <InfoRow label="Hobi"           value={patient.hobi}                                        icon={<Smile size={13} />} />
      </SectionCard>

      {/* Domisili */}
      <SectionCard title="Domisili" icon={<Home size={15} />}>
        <InfoRow label="Kelurahan"      value={patient.kelurahan} />
        <InfoRow label="Kecamatan"      value={patient.kecamatan} />
        <InfoRow label="Kabupaten/Kota" value={patient.kabupaten_kota} />
        <InfoRow label="Provinsi"       value={patient.provinsi} />
        {domisili && (
          <div className="pt-2 mt-1">
            <p className="text-xs text-muted-foreground">Alamat Lengkap</p>
            <p className="text-sm text-foreground mt-0.5">{domisili}</p>
          </div>
        )}
      </SectionCard>

      {/* Medis */}
      <SectionCard title="Catatan Medis" icon={<Stethoscope size={15} />}>
        <InfoRow label="Alergi"        value={patient.allergies}    icon={<AlertTriangle size={13} />} />
        {patient.allergies && (
          <div className="mt-1 mb-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20 text-xs text-destructive">
            Perhatian: Pasien memiliki riwayat alergi.
          </div>
        )}
        <InfoRow label="Catatan Medis" value={patient.medical_notes} icon={<HeartPulse size={13} />} />
      </SectionCard>
    </div>
  )
}
