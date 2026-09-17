'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react'
import { fetchVisitWithPatient, fetchBranchStaff, type VisitWithPatient, type BranchStaffMember } from '@/app/actions/jadwal'
import { fetchGriyaTerapiAwal, saveGriyaTerapiAwalDraft, completeGriyaTerapiAwal, type GriyaTerapiAwalFieldsInput } from '@/app/actions/griyaTerapiAwal'
import type { GriyaTerapiAwal, UserRole } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/context/ToastContext'

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const taCls = `${inputCls} resize-none`
const labelCls = 'block text-xs font-medium text-muted-foreground mb-2'

const FIELD_KEYS = [
  'keluhan_utama',
  'riwayat_keluarga',
  'berat_badan', 'tinggi_badan', 'lingkar_kepala',
  'usia_merayap', 'usia_merangkak', 'usia_duduk_mandiri', 'usia_merambat', 'usia_berjalan',
  'usia_menunjuk', 'usia_babbling', 'usia_mengucap_kata', 'toilet_training', 'pertumbuhan_lainnya',
  'riwayat_sakit',
  'kemampuan_menyedot', 'kemampuan_sikat_gigi', 'kemampuan_menghisap_pipet', 'kemampuan_meniup_lilin',
  'kemampuan_kontrol_liur', 'kemampuan_mengunyah', 'kemampuan_makan', 'bentuk_tekstur_makanan', 'wicara_lainnya',
  'kontak_mata', 'kemampuan_duduk_tenang',
  'diagnosa',
  'fisioterapi_motorik', 'fisioterapi_sensorik', 'terapi_wicara', 'terapi_okupasi', 'terapi_perilaku',
  'target_program_terapi',
  'jadwal_hari', 'jadwal_pukul',
] as const

type FieldKey = typeof FIELD_KEYS[number]

const EMPTY_FORM = Object.fromEntries(FIELD_KEYS.map((k) => [k, ''])) as Record<FieldKey, string>

function toForm(a: GriyaTerapiAwal | null): Record<FieldKey, string> {
  if (!a) return EMPTY_FORM
  const out = { ...EMPTY_FORM }
  for (const k of FIELD_KEYS) out[k] = (a[k] as string | null) ?? ''
  return out
}

function toFieldsInput(f: Record<FieldKey, string>, assessorSiId: string, assessorSiTanggal: string, assessorWicaraId: string, assessorWicaraTanggal: string): GriyaTerapiAwalFieldsInput {
  const out: GriyaTerapiAwalFieldsInput = {}
  for (const k of FIELD_KEYS) (out as Record<string, string | null>)[k] = f[k] || null
  out.assessor_si_id = assessorSiId || null
  out.assessor_si_tanggal = assessorSiTanggal || null
  out.assessor_wicara_id = assessorWicaraId || null
  out.assessor_wicara_tanggal = assessorWicaraTanggal || null
  return out
}

function Field({ label, k, value, onChange, textarea, required }: {
  label: string; k: string; value: string; onChange: (k: string, v: string) => void; textarea?: boolean; required?: boolean
}) {
  return (
    <div>
      <label className={labelCls}>{label}{required && ' *'}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(k, e.target.value)} rows={2} className={taCls} />
      ) : (
        <input value={value} onChange={(e) => onChange(k, e.target.value)} className={inputCls} />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5 sm:p-6 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export default function GriyaTerapiAwalPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>()
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [visit, setVisit] = useState<VisitWithPatient | null>(null)
  const [form, setForm] = useState<Record<FieldKey, string>>(EMPTY_FORM)
  const [assessorSiId, setAssessorSiId] = useState('')
  const [assessorSiTanggal, setAssessorSiTanggal] = useState('')
  const [assessorWicaraId, setAssessorWicaraId] = useState('')
  const [assessorWicaraTanggal, setAssessorWicaraTanggal] = useState('')
  const [staff, setStaff] = useState<BranchStaffMember[]>([])
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visitId) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchVisitWithPatient(visitId), fetchGriyaTerapiAwal(visitId)]).then(([v, a]) => {
      if (cancelled) return
      if (!v) { router.replace(`/griya-anak/siswa/${id}`); return }
      setVisit(v)
      setForm(toForm(a))
      setAssessorSiId(a?.assessor_si_id ?? '')
      setAssessorSiTanggal(a?.assessor_si_tanggal ?? '')
      setAssessorWicaraId(a?.assessor_wicara_id ?? '')
      setAssessorWicaraTanggal(a?.assessor_wicara_tanggal ?? '')
      setAlreadyCompleted(a?.status === 'completed')
      setLoading(false)
      fetchBranchStaff(v.branch_id).then((s) => { if (!cancelled) setStaff(s) })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('internal_profiles').select('role').eq('id', user.id).single()
      if (!cancelled) setUserRole((profile?.role as UserRole) ?? null)
    })
    return () => { cancelled = true }
  }, [])

  const isTherapistLike = userRole === 'therapist' || userRole === 'staff'
  const locked = isTherapistLike && alreadyCompleted

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function persistDraft() {
    if (!visit) return
    setSaving(true); setError(null)
    const { error: err } = await saveGriyaTerapiAwalDraft(
      visit.id, visit.patient_id, visit.branch_id,
      toFieldsInput(form, assessorSiId, assessorSiTanggal, assessorWicaraId, assessorWicaraTanggal),
    )
    setSaving(false)
    if (err) { setError(err); return }
    showToast('Draf disimpan', 'success')
  }

  async function handleComplete() {
    if (!visit) return
    if (!form.diagnosa.trim()) { setError('Diagnosa wajib diisi sebelum menyelesaikan Terapi Awal.'); return }
    setCompleting(true); setError(null)
    const { error: err } = await completeGriyaTerapiAwal(
      visit.id, visit.patient_id, visit.branch_id,
      toFieldsInput(form, assessorSiId, assessorSiTanggal, assessorWicaraId, assessorWicaraTanggal),
    )
    setCompleting(false)
    if (err) { setError(err); return }
    setAlreadyCompleted(true)
    showToast('Terapi Awal disimpan', 'success')
    router.push(`/griya-anak/siswa/${id}`)
  }

  if (loading || !visit) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl j-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <Link href={`/griya-anak/siswa/${id}`} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors shrink-0">
          <ChevronLeft size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{visit.patient_name}</h1>
          <p className="text-xs text-muted-foreground">
            Terapi Awal — Rekam Medis Sensori Integrasi · {visit.visit_date}
            {alreadyCompleted && <span className="ml-2 text-[#34C759] font-medium">Selesai</span>}
          </p>
        </div>
      </div>

      {locked && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
          Terapi Awal ini sudah dikunci setelah disimpan. Hubungi admin/manajer untuk perubahan.
        </div>
      )}

      <fieldset disabled={locked} className="contents border-0 m-0 p-2 min-w-0">
        <Section title="Keluhan Utama">
          <div className="sm:col-span-2">
            <Field label="Keluhan utama" k="keluhan_utama" value={form.keluhan_utama} onChange={set} textarea />
          </div>
        </Section>

        <Section title="Riwayat Keluarga">
          <div className="sm:col-span-2">
            <Field label="Keluarga dengan keluhan yang sama (Paman/Bibi/Keponakan)" k="riwayat_keluarga" value={form.riwayat_keluarga} onChange={set} textarea />
          </div>
        </Section>

        <Section title="Masa Pertumbuhan dan Perkembangan">
          <Field label="Berat badan" k="berat_badan" value={form.berat_badan} onChange={set} />
          <Field label="Tinggi badan" k="tinggi_badan" value={form.tinggi_badan} onChange={set} />
          <Field label="Lingkar kepala" k="lingkar_kepala" value={form.lingkar_kepala} onChange={set} />
          <Field label="Kemampuan merayap (usia … bulan)" k="usia_merayap" value={form.usia_merayap} onChange={set} />
          <Field label="Kemampuan merangkak (usia … bulan)" k="usia_merangkak" value={form.usia_merangkak} onChange={set} />
          <Field label="Kemampuan duduk mandiri (usia … bulan)" k="usia_duduk_mandiri" value={form.usia_duduk_mandiri} onChange={set} />
          <Field label="Kemampuan merambat (usia … bulan)" k="usia_merambat" value={form.usia_merambat} onChange={set} />
          <Field label="Kemampuan berjalan (usia … bulan)" k="usia_berjalan" value={form.usia_berjalan} onChange={set} />
          <Field label="Kemampuan menunjuk (usia … bulan)" k="usia_menunjuk" value={form.usia_menunjuk} onChange={set} />
          <Field label="Kemampuan babbling (usia … bulan)" k="usia_babbling" value={form.usia_babbling} onChange={set} />
          <Field label="Kemampuan mengucapkan kata (usia … bulan)" k="usia_mengucap_kata" value={form.usia_mengucap_kata} onChange={set} />
          <Field label="Toilet training" k="toilet_training" value={form.toilet_training} onChange={set} />
          <div className="sm:col-span-2">
            <Field label="Dan lain-lain" k="pertumbuhan_lainnya" value={form.pertumbuhan_lainnya} onChange={set} textarea />
          </div>
        </Section>

        <Section title="Riwayat Sakit / Keluhan (Rawat Inap/Rawat Jalan/Konsultasi/Terapi)">
          <div className="sm:col-span-2">
            <Field label="Riwayat" k="riwayat_sakit" value={form.riwayat_sakit} onChange={set} textarea />
          </div>
        </Section>

        <Section title="Masalah Wicara / Oral Motor">
          <Field label="Kemampuan menyedot (direct breastfeeding/dot)" k="kemampuan_menyedot" value={form.kemampuan_menyedot} onChange={set} />
          <Field label="Kemampuan sikat gigi (mau/tidak)" k="kemampuan_sikat_gigi" value={form.kemampuan_sikat_gigi} onChange={set} />
          <Field label="Kemampuan menghisap pipet (bisa/tidak)" k="kemampuan_menghisap_pipet" value={form.kemampuan_menghisap_pipet} onChange={set} />
          <Field label="Kemampuan meniup lilin (bisa/tidak)" k="kemampuan_meniup_lilin" value={form.kemampuan_meniup_lilin} onChange={set} />
          <Field label="Kemampuan kontrol liur (bisa/tidak)" k="kemampuan_kontrol_liur" value={form.kemampuan_kontrol_liur} onChange={set} />
          <Field label="Kemampuan mengunyah (mengunyah/mengulum)" k="kemampuan_mengunyah" value={form.kemampuan_mengunyah} onChange={set} />
          <Field label="Kemampuan makan (tersedak/batuk/baik saja)" k="kemampuan_makan" value={form.kemampuan_makan} onChange={set} />
          <Field label="Bentuk tekstur makanan (halus-bayi/kasar-dewasa)" k="bentuk_tekstur_makanan" value={form.bentuk_tekstur_makanan} onChange={set} />
          <div className="sm:col-span-2">
            <Field label="Dan lain-lain" k="wicara_lainnya" value={form.wicara_lainnya} onChange={set} textarea />
          </div>
        </Section>

        <Section title="Pemeriksaan Objektif/Penunjang">
          <Field label="Kontak mata" k="kontak_mata" value={form.kontak_mata} onChange={set} />
          <Field label="Kemampuan duduk tenang" k="kemampuan_duduk_tenang" value={form.kemampuan_duduk_tenang} onChange={set} />
        </Section>

        <Section title="Diagnosa (dari Assessor)">
          <div className="sm:col-span-2">
            <Field label="Diagnosa" k="diagnosa" value={form.diagnosa} onChange={set} textarea required />
          </div>
        </Section>

        <Section title="Program Rencana Terapi">
          <Field label="Fisioterapi Motorik" k="fisioterapi_motorik" value={form.fisioterapi_motorik} onChange={set} />
          <Field label="Fisioterapi Sensorik / Sensori Integrasi" k="fisioterapi_sensorik" value={form.fisioterapi_sensorik} onChange={set} />
          <Field label="Terapi Wicara" k="terapi_wicara" value={form.terapi_wicara} onChange={set} />
          <Field label="Terapi Okupasi" k="terapi_okupasi" value={form.terapi_okupasi} onChange={set} />
          <Field label="Terapi Perilaku" k="terapi_perilaku" value={form.terapi_perilaku} onChange={set} />
        </Section>

        <Section title="Target & Program Terapi">
          <div className="sm:col-span-2">
            <Field label="Target & Program" k="target_program_terapi" value={form.target_program_terapi} onChange={set} textarea />
          </div>
        </Section>

        <Section title="Jadwal Terapi (menyesuaikan orang tua dan jadwal kosong praktik)">
          <Field label="Hari" k="jadwal_hari" value={form.jadwal_hari} onChange={set} />
          <Field label="Pukul" k="jadwal_pukul" value={form.jadwal_pukul} onChange={set} />
        </Section>

        <Section title="Asesor">
          <div>
            <label className={labelCls}>Asesor Sensori Integrasi</label>
            <select value={assessorSiId} onChange={(e) => setAssessorSiId(e.target.value)} className={inputCls}>
              <option value="">— pilih —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.nickname || s.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tanggal</label>
            <input type="date" value={assessorSiTanggal} onChange={(e) => setAssessorSiTanggal(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Asesor Terapi Wicara</label>
            <select value={assessorWicaraId} onChange={(e) => setAssessorWicaraId(e.target.value)} className={inputCls}>
              <option value="">— pilih —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.nickname || s.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tanggal</label>
            <input type="date" value={assessorWicaraTanggal} onChange={(e) => setAssessorWicaraTanggal(e.target.value)} className={inputCls} />
          </div>
        </Section>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pb-6">
          <button type="button" onClick={persistDraft} disabled={saving || completing}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer">
            {saving ? 'Menyimpan...' : 'Simpan Draf'}
          </button>
          <button type="button" onClick={handleComplete} disabled={saving || completing}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {completing ? 'Menyelesaikan...' : 'Selesaikan Terapi Awal'}
          </button>
        </div>
      </fieldset>
    </div>
  )
}
