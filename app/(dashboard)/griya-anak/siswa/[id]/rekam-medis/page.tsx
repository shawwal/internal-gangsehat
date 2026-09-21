'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, Pencil, Printer } from 'lucide-react'
import { fetchPatient, type PatientPlain } from '@/app/actions/patients'
import { fetchGriyaMedicalRecords, type GriyaMedicalRecords, type GriyaRecordEntry } from '@/app/actions/griyaMedicalRecords'
import { SessionNoteModal } from '@/components/griya/SessionNoteModal'
import { useToast } from '@/context/ToastContext'
import { createClient } from '@/lib/supabase/client'
import type { GriyaTerapiAwal } from '@/types'

const TA_SECTIONS: { title: string; fields: [keyof GriyaTerapiAwal, string][] }[] = [
  { title: 'Keluhan & Riwayat', fields: [['keluhan_utama', 'Keluhan Utama'], ['riwayat_keluarga', 'Riwayat Keluarga'], ['riwayat_sakit', 'Riwayat Sakit/Keluhan']] },
  { title: 'Pertumbuhan & Perkembangan', fields: [
    ['berat_badan', 'Berat Badan'], ['tinggi_badan', 'Tinggi Badan'], ['lingkar_kepala', 'Lingkar Kepala'],
    ['usia_merayap', 'Usia Merayap'], ['usia_merangkak', 'Usia Merangkak'], ['usia_duduk_mandiri', 'Usia Duduk Mandiri'],
    ['usia_merambat', 'Usia Merambat'], ['usia_berjalan', 'Usia Berjalan'], ['usia_menunjuk', 'Usia Menunjuk'],
    ['usia_babbling', 'Usia Babbling'], ['usia_mengucap_kata', 'Usia Mengucap Kata'], ['toilet_training', 'Toilet Training'],
    ['pertumbuhan_lainnya', 'Lainnya'],
  ] },
  { title: 'Wicara / Oral Motor', fields: [
    ['kemampuan_menyedot', 'Menyedot'], ['kemampuan_sikat_gigi', 'Sikat Gigi'], ['kemampuan_menghisap_pipet', 'Menghisap Pipet'],
    ['kemampuan_meniup_lilin', 'Meniup Lilin'], ['kemampuan_kontrol_liur', 'Kontrol Liur'], ['kemampuan_mengunyah', 'Mengunyah'],
    ['kemampuan_makan', 'Makan'], ['bentuk_tekstur_makanan', 'Bentuk/Tekstur Makanan'], ['wicara_lainnya', 'Lainnya'],
  ] },
  { title: 'Pemeriksaan Objektif', fields: [['kontak_mata', 'Kontak Mata'], ['kemampuan_duduk_tenang', 'Duduk Tenang']] },
  { title: 'Diagnosa & Program Terapi', fields: [
    ['diagnosa', 'Diagnosa'], ['fisioterapi_motorik', 'Fisioterapi Motorik'], ['fisioterapi_sensorik', 'Fisioterapi Sensorik'],
    ['terapi_wicara', 'Terapi Wicara'], ['terapi_okupasi', 'Terapi Okupasi'], ['terapi_perilaku', 'Terapi Perilaku'],
    ['target_program_terapi', 'Target & Program Terapi'], ['jadwal_hari', 'Jadwal Hari'], ['jadwal_pukul', 'Jadwal Pukul'],
  ] },
]

const SOAP: [keyof NonNullable<GriyaRecordEntry['note']>, string][] = [
  ['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'],
  ['plan', 'Plan'], ['keterangan_periksa', 'Keterangan Periksa'],
]

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
}

function StatusChip({ status }: { status: 'completed' | 'draft' | null }) {
  const cls = status === 'completed' ? 'bg-[#34C759]/15 text-[#34C759]'
    : status === 'draft' ? 'bg-[#FFB35C]/15 text-[#FFB35C]' : 'bg-destructive/15 text-destructive'
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cls}`}>{status === 'completed' ? 'Lengkap' : status === 'draft' ? 'Draf' : 'Belum diisi'}</span>
}

export default function GriyaRekamMedisPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const [patient, setPatient] = useState<PatientPlain | null>(null)
  const [data, setData] = useState<GriyaMedicalRecords | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [edit, setEdit] = useState<GriyaRecordEntry | null>(null)

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([fetchPatient(id), fetchGriyaMedicalRecords(id)])
    setPatient(p); setData(r)
  }, [id])

  useEffect(() => {
    load()
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: pr } = await sb.from('internal_profiles').select('role').eq('id', user.id).single()
      setRole(pr?.role ?? null)
    })
  }, [load])

  const canEdit = !!role && ['director', 'manager', 'admin', 'therapist'].includes(role)

  if (!data || !patient) return <div className="text-sm text-muted-foreground">Memuat...</div>

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href={`/griya-anak/siswa/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft size={15} /> Kembali ke profil anak
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">
          <Printer size={14} /> Cetak
        </button>
      </div>

      <div className="glass-card p-5">
        <h1 className="text-xl font-semibold text-foreground">Rekam Medis — {patient.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {patient.no_rm ? `No. RM ${patient.no_rm} · ` : ''}{data.entries.length} catatan
        </p>
      </div>

      {data.entries.length === 0 && (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">Belum ada rekam medis.</div>
      )}

      {data.entries.map((e) => {
        const status = e.kind === 'terapi-awal' ? (e.terapiAwal?.status ?? null) : (e.note?.status ?? null)
        return (
          <div key={e.visitId} className="glass-card overflow-hidden break-inside-avoid">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-foreground">
                {e.kind === 'terapi-awal' ? 'Terapi Awal' : `Pertemuan Ke-${e.pertemuanKe}`}
              </h2>
              <StatusChip status={status} />
              <span className="text-xs text-muted-foreground">
                {fmtDate(e.visitDate)}{e.visitTime && ` · ${e.visitTime}`}{e.therapistName && ` · ${e.therapistName}`}
              </span>
              <div className="ml-auto flex items-center gap-1 print:hidden">
                {e.kind === 'terapi-awal' ? (
                  <Link href={`/griya-anak/siswa/${id}/terapi-awal/${e.visitId}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Buka form">
                    <ExternalLink size={13} />
                  </Link>
                ) : canEdit && (
                  <button onClick={() => setEdit(e)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer" title="Isi / ubah">
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>

            {e.kind === 'terapi-awal' ? (
              e.terapiAwal ? (
                <div className="p-4 space-y-4">
                  {TA_SECTIONS.map((sec) => {
                    const filled = sec.fields.filter(([k]) => e.terapiAwal![k])
                    if (filled.length === 0) return null
                    return (
                      <div key={sec.title}>
                        <p className="text-xs font-semibold text-primary mb-1.5">{sec.title}</p>
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                          {filled.map(([k, label]) => (
                            <div key={k as string} className="flex gap-2">
                              <dt className="text-muted-foreground shrink-0">{label}:</dt>
                              <dd className="text-foreground whitespace-pre-wrap">{String(e.terapiAwal![k])}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="px-4 py-4 text-sm text-muted-foreground">Formulir Terapi Awal belum diisi.</p>
            ) : e.note ? (
              <dl className="p-4 space-y-2.5 text-sm">
                {SOAP.map(([k, label]) => (
                  <div key={k as string}>
                    <dt className="text-xs font-semibold text-primary">{label}</dt>
                    <dd className="text-foreground whitespace-pre-wrap">{(e.note![k] as string | null) || '—'}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                {e.attended ? 'Rekam medis belum diisi.' : 'Belum ada catatan (anak belum hadir).'}
              </p>
            )}
          </div>
        )
      })}

      {edit && data.branchId && (
        <SessionNoteModal
          target={{ visitId: edit.visitId, patientId: id, patientName: patient.name, branchId: data.branchId, griyaSlotId: edit.griyaSlotId }}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); showToast('Rekam periksa disimpan', 'success'); load() }}
        />
      )}
    </div>
  )
}
