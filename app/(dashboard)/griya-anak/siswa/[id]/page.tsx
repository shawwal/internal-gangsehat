'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, GraduationCap, RotateCcw, Phone, MapPin, Users, CalendarClock, Pencil } from 'lucide-react'
import { StudentEditForm } from '@/components/griya/StudentEditForm'
import { EditVisitDialog } from '@/components/griya/EditVisitDialog'
import { fetchPatient, type PatientPlain } from '@/app/actions/patients'
import { fetchPatientPackages, fetchPackageSessions } from '@/app/actions/packages'
import { deleteVisit } from '@/app/actions/jadwal'
import { SessionList } from '@/components/packages/SessionList'
import { ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import type { PatientPackage, PackageSession } from '@/types'
import { fetchGriyaStudentDetail, setGriyaStudentStatus, type GriyaStudentDetail } from '@/app/actions/griyaStudents'
import { GENDER_LABEL, calcAge } from '@/components/patients/detail/constants'
import { HARI_LABEL, DISCIPLINE_LABEL } from '@/components/griya/constants'
import { useToast } from '@/context/ToastContext'
import type { Discipline, Hari } from '@/app/actions/griyaJadwal'

const STATUS_LABEL: Record<string, string> = { active: 'Aktif', graduated: 'Lulus', inactive: 'Nonaktif' }
const STATUS_CLS: Record<string, string> = {
  active: 'bg-[#34C759]/15 text-[#34C759]',
  graduated: 'bg-primary/15 text-primary',
  inactive: 'bg-muted text-muted-foreground',
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function kehadiranBadge(v: { status: string; kehadiran: string | null }) {
  if (v.kehadiran === 'HADIR' || v.status === 'completed') return { t: 'Hadir', c: 'bg-[#34C759]/15 text-[#34C759]' }
  if (v.status === 'no_show') return { t: 'Alpa', c: 'bg-[#FF3B30]/15 text-[#FF3B30]' }
  if (v.status === 'cancelled') return { t: v.kehadiran === 'TIDAK HADIR' ? 'Izin/Sakit' : 'Batal', c: 'bg-[#FFB35C]/20 text-[#FFB35C]' }
  return { t: 'Terjadwal', c: 'bg-primary/15 text-primary' }
}

export default function GriyaSiswaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const [patient, setPatient] = useState<PatientPlain | null>(null)
  const [detail, setDetail] = useState<GriyaStudentDetail | null>(null)
  const [packages, setPackages] = useState<PatientPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editVisitId, setEditVisitId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [p, d, pk] = await Promise.all([fetchPatient(id), fetchGriyaStudentDetail(id), fetchPatientPackages(id)])
    setPatient(p); setDetail(d); setPackages(pk); setLoading(false)
  }
  useEffect(() => {
    load()
    import('@/lib/supabase/client').then(async ({ createClient }) => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data } = await sb.from('internal_profiles').select('role').eq('id', user.id).single()
        setRole(data?.role ?? null)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const canEdit = !!role && ['director', 'manager', 'admin'].includes(role)

  if (loading) return <div className="text-sm text-muted-foreground">Memuat...</div>
  if (!patient) return <div className="glass-card p-8 text-sm text-muted-foreground">Pasien tidak ditemukan.</div>

  const activeSlots = detail?.slots.filter((s) => s.status === 'active') ?? []
  const pastSlots = detail?.slots.filter((s) => s.status !== 'active') ?? []

  async function setStatus(s: 'active' | 'graduated') {
    const { error } = await setGriyaStudentStatus(id, s)
    if (error) showToast(error, 'error')
    else { showToast('Status diperbarui', 'success'); load() }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Link href="/griya-anak/siswa" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={15} /> Kembali ke daftar siswa
      </Link>

      {/* header */}
      <div className="glass-card p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{patient.name}</h1>
            {detail?.status && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[detail.status]}`}>{STATUS_LABEL[detail.status] ?? detail.status}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {patient.gender ? GENDER_LABEL[patient.gender] : '—'} · {calcAge(patient.birthDate)}
            {patient.birthDate && ` · lahir ${fmtDate(patient.birthDate)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">
              <Pencil size={14} /> Ubah Data
            </button>
          )}
          <a href={`/patients/${id}/visits`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">
            <ExternalLink size={14} /> Rekam Pasien
          </a>
          {canEdit && detail?.status !== 'graduated' && (
            <button onClick={() => setStatus('graduated')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">
              <GraduationCap size={14} /> Tandai Lulus
            </button>
          )}
          {canEdit && detail?.status !== 'active' && (
            <button onClick={() => setStatus('active')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">
              <RotateCcw size={14} /> Aktifkan
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <StudentEditForm
          patient={patient}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); showToast('Data disimpan', 'success'); load() }}
        />
      ) : (
        /* info + stats */
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-card p-4 md:col-span-2 space-y-2 text-sm">
            {patient.no_rm && <p><span className="text-muted-foreground">No. RM:</span> {patient.no_rm}</p>}
            {patient.agama && <p><span className="text-muted-foreground">Agama:</span> {patient.agama}</p>}
            {patient.sumber && <p><span className="text-muted-foreground">Sumber:</span> {patient.sumber}</p>}
            {patient.keluhan && <p><span className="text-muted-foreground">Keluhan:</span> {patient.keluhan}</p>}
            {(patient.nama_ibu || patient.nama_ayah) && (
              <p className="flex gap-1.5">
                <Users size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  {[
                    patient.nama_ibu && `Ibu: ${patient.nama_ibu}${patient.pekerjaan_ibu ? ` (${patient.pekerjaan_ibu})` : ''}`,
                    patient.nama_ayah && `Ayah: ${patient.nama_ayah}${patient.pekerjaan_ayah ? ` (${patient.pekerjaan_ayah})` : ''}`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </p>
            )}
            {patient.medical_notes && <p className="text-muted-foreground">{patient.medical_notes}</p>}
            {patient.phone && <p className="flex gap-1.5"><Phone size={14} className="mt-0.5 shrink-0 text-muted-foreground" />{patient.phone}</p>}
            {(patient.address || patient.kecamatan) && (
              <p className="flex gap-1.5">
                <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                {[patient.address, patient.kelurahan, patient.kecamatan, patient.kabupaten_kota].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div className="glass-card p-4 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-lg font-bold text-[#34C759]">{detail?.stats.attended ?? 0}</div><div className="text-[10px] text-muted-foreground uppercase">Hadir</div></div>
            <div><div className="text-lg font-bold text-[#FF3B30]">{detail?.stats.absent ?? 0}</div><div className="text-[10px] text-muted-foreground uppercase">Absen</div></div>
            <div><div className="text-lg font-bold text-primary">{detail?.stats.scheduled ?? 0}</div><div className="text-[10px] text-muted-foreground uppercase">Terjadwal</div></div>
          </div>
        </div>
      )}

      {/* recurring schedule */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <CalendarClock size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Jadwal Rutin</h2>
        </div>
        {activeSlots.length === 0 && pastSlots.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground text-center">Belum ada jadwal rutin.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {[...activeSlots, ...pastSlots].map((s) => (
                <tr key={s.id} className={`border-b border-border last:border-0 ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 font-medium">{DISCIPLINE_LABEL[s.discipline as Discipline] ?? s.discipline}</td>
                  <td className="px-4 py-2">{HARI_LABEL[s.hari as Hari] ?? s.hari} · {s.slot_time}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.therapist_name}</td>
                  <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{s.service_type ?? ''}</td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                    {s.status === 'active' ? `sejak ${fmtDate(s.start_date)}` : `${STATUS_LABEL[s.status] ?? s.status}${s.end_date ? ` ${fmtDate(s.end_date)}` : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* packages */}
      {packages.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h2 className="text-sm font-semibold text-foreground">Paket</h2></div>
          <div className="divide-y divide-border">
            {packages.map((p) => (
              <PackagePanel
                key={p.id}
                pkg={p}
                canEdit={canEdit}
                onEditVisit={(vid) => setEditVisitId(vid)}
                onChanged={load}
              />
            ))}
          </div>
        </div>
      )}

      {/* visit history */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h2 className="text-sm font-semibold text-foreground">Riwayat Kunjungan</h2></div>
        {(detail?.visits.length ?? 0) === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground text-center">Belum ada kunjungan tercatat.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Layanan</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Terapis</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Kehadiran</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Catatan</th>
                  {canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {detail!.visits.map((v) => {
                  const b = kehadiranBadge(v)
                  return (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{fmtDate(v.visit_date)}{v.visit_time && <span className="text-muted-foreground"> {v.visit_time}</span>}</td>
                      <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{v.service_type ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{v.therapist_name ?? '—'}</td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${b.c}`}>{b.t}</span></td>
                      <td className="px-4 py-2 text-muted-foreground hidden lg:table-cell max-w-xs truncate">{v.notes ?? ''}</td>
                      {canEdit && (
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => setEditVisitId(v.id)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer" title="Ubah kunjungan">
                            <Pencil size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editVisitId && detail?.branchId && (() => {
        const v = detail.visits.find((x) => x.id === editVisitId)
        if (!v) return null
        return (
          <EditVisitDialog
            visit={{ ...v, patient_name: patient.name }}
            branchId={detail.branchId}
            onClose={() => setEditVisitId(null)}
            onSaved={() => { setEditVisitId(null); showToast('Kunjungan diperbarui', 'success'); load() }}
          />
        )
      })()}
    </div>
  )
}

function PackagePanel({ pkg, canEdit, onEditVisit, onChanged }: {
  pkg: PatientPackage
  canEdit: boolean
  onEditVisit: (visitId: string) => void
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<PackageSession[] | null>(null)
  const [loading, setLoading] = useState(false)

  const remaining = pkg.total_sessions - pkg.used_sessions

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && sessions === null) {
      setLoading(true)
      fetchPackageSessions(pkg.id).then((s) => { setSessions(s); setLoading(false) })
    }
  }

  async function handleDelete(s: PackageSession) {
    if (!confirm('Hapus sesi ini dari riwayat?')) return
    const { error } = await deleteVisit(s.id)
    if (error) { alert(error); return }
    setSessions(null)
    setLoading(true)
    fetchPackageSessions(pkg.id).then((rows) => { setSessions(rows); setLoading(false) })
    onChanged()
  }

  return (
    <div>
      <button onClick={toggle} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/40 cursor-pointer">
        {open ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRightIcon size={14} className="text-muted-foreground shrink-0" />}
        <span className="font-medium text-foreground truncate flex-1 text-left">{pkg.package_name}</span>
        <span className="text-muted-foreground shrink-0">{pkg.used_sessions}/{pkg.total_sessions} sesi</span>
        <span className={`text-xs shrink-0 ${remaining <= 0 ? 'text-[#FF3B30]' : 'text-muted-foreground'}`}>
          {remaining > 0 ? `${remaining} tersisa` : '⚠ habis'}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${pkg.status === 'active' ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-muted text-muted-foreground'}`}>
          {pkg.status === 'active' ? 'Aktif' : pkg.status}
        </span>
      </button>
      {open && (
        <div className="bg-muted/20 border-t border-border">
          <SessionList
            sessions={sessions}
            loading={loading}
            onEdit={(s) => { if (canEdit) onEditVisit(s.id) }}
            onDelete={handleDelete}
            canDelete={canEdit}
          />
        </div>
      )}
    </div>
  )
}
