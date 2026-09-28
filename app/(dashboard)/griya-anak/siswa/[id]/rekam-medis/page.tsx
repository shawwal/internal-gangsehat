'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, Pencil, FileDown, Loader2 } from 'lucide-react'
import { fetchPatient, type PatientPlain } from '@/app/actions/patients'
import { fetchGriyaMedicalRecords, type GriyaMedicalRecords, type GriyaRecordEntry } from '@/app/actions/griyaMedicalRecords'
import { SessionNoteModal } from '@/components/griya/SessionNoteModal'
import { useToast } from '@/context/ToastContext'
import { createClient } from '@/lib/supabase/client'
import { RM_TYPES, displayRmValue } from '@/components/griya/rekam-medis/sections'
import { downloadGriyaRekamMedisPdf, type GriyaPdfBlock } from '@/lib/downloadGriyaRekamMedisPdf'

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
  const [exporting, setExporting] = useState(false)

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

  async function exportPdf() {
    if (!data || !patient) return
    setExporting(true)
    try {
      const blocks: GriyaPdfBlock[] = data.entries.map((e) => {
        const st = e.kind === 'terapi-awal' ? (e.terapiAwal?.status ?? null) : (e.note?.status ?? null)
        const heading = e.kind === 'terapi-awal' ? `Terapi Awal — ${RM_TYPES[e.rmType].formTitle}` : `Pertemuan Ke-${e.pertemuanKe}`
        const meta = [fmtDate(e.visitDate), e.visitTime, e.therapistName].filter(Boolean).join(' · ')
        const status = st === 'completed' ? 'Lengkap' : st === 'draft' ? 'Draf' : 'Belum diisi'
        if (e.kind === 'terapi-awal') {
          if (!e.terapiAwal) return { heading, meta, status, groups: [], empty: 'Formulir Terapi Awal belum diisi.' }
          const groups = RM_TYPES[e.rmType].sections.map((sec) => ({
            title: sec.title.replace(/ \*$/, ''),
            rows: sec.fields.filter((f) => e.terapiAwal![f.k]).map((f) => [f.label, displayRmValue(f, String(e.terapiAwal![f.k]))] as [string, string]),
          })).filter((g) => g.rows.length)
          return { heading, meta, status, groups, signature: { role: RM_TYPES[e.rmType].signRole, name: e.assessorName ?? e.therapistName } }
        }
        if (!e.note) return { heading, meta, status, groups: [], empty: e.attended ? 'Rekam medis belum diisi.' : 'Belum ada catatan (anak belum hadir).' }
        return { heading, meta, status, groups: [{ rows: SOAP.map(([k, l]) => [l, (e.note![k] as string | null) || '—'] as [string, string]) }] }
      })
      const safe = patient.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
      const latestTa = data.entries.find((e) => e.kind === 'terapi-awal')
      await downloadGriyaRekamMedisPdf({
        title: latestTa ? RM_TYPES[latestTa.rmType].pdfTitle : 'REKAM MEDIS',
        patient,
        blocks, filename: `Rekam_Medis_${safe}.pdf`,
      })
    } catch {
      showToast('Gagal membuat PDF', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (!data || !patient) return <div className="text-sm text-muted-foreground">Memuat...</div>

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href={`/griya-anak/siswa/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft size={15} /> Kembali ke profil anak
        </Link>
        <button onClick={exportPdf} disabled={exporting} className="flex disabled:opacity-60 items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {exporting ? 'Membuat PDF...' : 'Unduh PDF'}
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
                {e.kind === 'terapi-awal' ? `Terapi Awal — ${RM_TYPES[e.rmType].label}` : `Pertemuan Ke-${e.pertemuanKe}`}
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
                  {RM_TYPES[e.rmType].sections.map((sec) => {
                    const filled = sec.fields.filter((f) => e.terapiAwal![f.k])
                    if (filled.length === 0) return null
                    return (
                      <div key={sec.title}>
                        <p className="text-xs font-semibold text-primary mb-1.5">{sec.title.replace(/ \*$/, '')}</p>
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                          {filled.map((f) => (
                            <div key={f.k} className="flex gap-2">
                              <dt className="text-muted-foreground shrink-0">{f.label}:</dt>
                              <dd className="text-foreground whitespace-pre-wrap">{displayRmValue(f, String(e.terapiAwal![f.k]))}</dd>
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
