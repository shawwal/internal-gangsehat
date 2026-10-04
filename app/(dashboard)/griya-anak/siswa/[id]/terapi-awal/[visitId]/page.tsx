'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { fetchVisitWithPatient, fetchBranchStaff, type VisitWithPatient, type BranchStaffMember } from '@/app/actions/jadwal'
import { fetchGriyaTerapiAwal, saveGriyaTerapiAwalDraft, completeGriyaTerapiAwal, type GriyaTerapiAwalFieldsInput } from '@/app/actions/griyaTerapiAwal'
import type { GriyaTerapiAwal, UserRole } from '@/types'
import type { GriyaRmType } from '@/lib/griyaVisitRouting'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/context/ToastContext'
import { ALL_RM_FIELD_KEYS, RM_TYPES, RM_TYPE_ORDER, validateRm, type RmFieldKey } from '@/components/griya/rekam-medis/sections'
import { RmSections, Section, inputCls, labelCls } from '@/components/griya/rekam-medis/RmSections'
import { useAutoSave } from '@/hooks/useAutoSave'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import TerapiAwalLoading from './loading'

type Form = Record<RmFieldKey, string>

const EMPTY_FORM = Object.fromEntries(ALL_RM_FIELD_KEYS.map((k) => [k, ''])) as Form

function toForm(a: GriyaTerapiAwal | null): Form {
  if (!a) return EMPTY_FORM
  const out = { ...EMPTY_FORM }
  for (const k of ALL_RM_FIELD_KEYS) out[k] = (a[k] as string | null) ?? ''
  return out
}

type Assessors = { siId: string; siTanggal: string; wicaraId: string; wicaraTanggal: string }

function toFieldsInput(f: Form, type: GriyaRmType, a: Assessors): GriyaTerapiAwalFieldsInput {
  const out: GriyaTerapiAwalFieldsInput = {}
  for (const k of ALL_RM_FIELD_KEYS) (out as Record<string, string | null>)[k] = f[k] || null
  out.rm_type = type
  out.assessor_si_id = a.siId || null
  out.assessor_si_tanggal = a.siTanggal || null
  out.assessor_wicara_id = a.wicaraId || null
  out.assessor_wicara_tanggal = a.wicaraTanggal || null
  return out
}

function AssessorPicker({ label, staff, id, tanggal, onId, onTanggal }: {
  label: string; staff: BranchStaffMember[]; id: string; tanggal: string; onId: (v: string) => void; onTanggal: (v: string) => void
}) {
  return (
    <>
      <div>
        <label className={labelCls}>{label}</label>
        <select value={id} onChange={(e) => onId(e.target.value)} className={inputCls}>
          <option value="">— pilih —</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.nickname || s.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Tanggal</label>
        <input type="date" value={tanggal} onChange={(e) => onTanggal(e.target.value)} className={inputCls} />
      </div>
    </>
  )
}

export default function GriyaTerapiAwalPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>()
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [visit, setVisit] = useState<VisitWithPatient | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [rmType, setRmType] = useState<GriyaRmType>('DEFAULT')
  const [suggestedType, setSuggestedType] = useState<GriyaRmType>('DEFAULT')
  const [assessors, setAssessors] = useState<Assessors>({ siId: '', siTanggal: '', wicaraId: '', wicaraTanggal: '' })
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
    Promise.all([fetchVisitWithPatient(visitId), fetchGriyaTerapiAwal(visitId)]).then(([v, { record: a, suggestedType: sug }]) => {
      if (cancelled) return
      if (!v) { router.replace(`/griya-anak/siswa/${id}`); return }
      setVisit(v)
      setForm(toForm(a))
      setSuggestedType(sug)
      setRmType(a?.rm_type ?? sug)
      setAssessors({
        siId: a?.assessor_si_id ?? '',
        siTanggal: a?.assessor_si_tanggal ?? '',
        wicaraId: a?.assessor_wicara_id ?? '',
        wicaraTanggal: a?.assessor_wicara_tanggal ?? '',
      })
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
  const meta = RM_TYPES[rmType]

  const autoSave = useAutoSave(
    visit && !loading ? toFieldsInput(form, rmType, assessors) : null,
    (fields) => saveGriyaTerapiAwalDraft(visit!.id, visit!.patient_id, visit!.branch_id, fields),
    { enabled: !alreadyCompleted && !completing },
  )

  function set(k: RmFieldKey, v: string) { setForm((f) => ({ ...f, [k]: v })) }
  const setA = (patch: Partial<Assessors>) => setAssessors((a) => ({ ...a, ...patch }))

  async function persistDraft() {
    if (!visit) return
    setSaving(true); setError(null)
    const fields = toFieldsInput(form, rmType, assessors)
    const { error: err } = await saveGriyaTerapiAwalDraft(visit.id, visit.patient_id, visit.branch_id, fields)
    setSaving(false)
    if (err) { setError(err); return }
    autoSave.markSaved(fields)
    showToast('Draf disimpan', 'success')
  }

  async function handleComplete() {
    if (!visit) return
    const invalid = validateRm(rmType, form)
    if (invalid) { setError(invalid); return }
    setCompleting(true); setError(null)
    await autoSave.flush()
    const { error: err } = await completeGriyaTerapiAwal(visit.id, visit.patient_id, visit.branch_id, toFieldsInput(form, rmType, assessors))
    setCompleting(false)
    if (err) { setError(err); return }
    setAlreadyCompleted(true)
    showToast('Terapi Awal disimpan', 'success')
    router.push(`/griya-anak/siswa/${id}`)
  }

  if (loading || !visit) {
    return <TerapiAwalLoading />
  }

  return (
    <div className="space-y-5 max-w-5xl j-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <Link href={`/griya-anak/siswa/${id}`} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors shrink-0">
          <ChevronLeft size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-foreground truncate">{visit.patient_name}</h1>
          <p className="text-xs text-muted-foreground">
            Terapi Awal — {meta.formTitle} · {visit.visit_date}
            {alreadyCompleted && <span className="ml-2 text-[#34C759] font-medium">Selesai</span>}
          </p>
          {!alreadyCompleted && <AutoSaveIndicator status={autoSave.status} savedAt={autoSave.savedAt} />}
        </div>
      </div>

      {locked && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
          Terapi Awal ini sudah dikunci setelah disimpan. Hubungi admin/manajer untuk perubahan.
        </div>
      )}

      <div className="glass-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 sm:mr-auto">
          <p className="text-sm font-semibold text-foreground">Jenis Rekam Medis</p>
          <p className="text-xs text-muted-foreground">Data yang sudah diisi tetap tersimpan saat berganti jenis.</p>
        </div>
        <div role="radiogroup" aria-label="Jenis Rekam Medis" className="inline-flex p-1 rounded-2xl bg-muted gap-1 self-start sm:self-auto">
          {RM_TYPE_ORDER.map((t) => {
            const active = rmType === t
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={locked}
                onClick={() => setRmType(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  active ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {RM_TYPES[t].label}
                {t === suggestedType && <span className="ml-1 text-[10px] opacity-60">(sesuai layanan)</span>}
              </button>
            )
          })}
        </div>
      </div>

      <fieldset disabled={locked} onBlur={autoSave.onBlur} className="border-0 m-0 p-0 min-w-0 space-y-5">
        <RmSections sections={meta.sections} form={form} set={set} />

        <Section title={rmType === 'DEFAULT' ? 'Asesor' : 'Penanggung Jawab'}>
          <AssessorPicker
            label={meta.assessorLabel} staff={staff}
            id={assessors.siId} tanggal={assessors.siTanggal}
            onId={(v) => setA({ siId: v })} onTanggal={(v) => setA({ siTanggal: v })}
          />
          {rmType === 'DEFAULT' && (
            <AssessorPicker
              label="Asesor Terapi Wicara" staff={staff}
              id={assessors.wicaraId} tanggal={assessors.wicaraTanggal}
              onId={(v) => setA({ wicaraId: v })} onTanggal={(v) => setA({ wicaraTanggal: v })}
            />
          )}
        </Section>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}

        <div className="sticky bottom-4 z-10 glass-card flex items-center justify-end gap-2 p-3">
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
