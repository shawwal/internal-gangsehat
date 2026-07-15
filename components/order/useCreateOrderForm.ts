'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'
import { fetchTherapistOptions, type TherapistOption } from '@/app/actions/orders'
import { fetchPatient, type PatientPlain } from '@/app/actions/patients'
import { createOrder } from '@/app/actions/createOrder'
import { DISCOUNT_PRESETS, DRAFT_STORAGE_KEY } from './constants'
import type { CreateOrderForm, CreateOrderFormErrors, SessionRow } from './types'

interface Branch {
  id: string
  name: string
}

function newSessionKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())
}

function buildWeeklySessions(startDate: string, count: number): SessionRow[] {
  if (!startDate || count <= 0) return []
  const base = new Date(startDate + 'T00:00:00')
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i * 7)
    return {
      key: newSessionKey(),
      session_number: i + 1,
      tanggal: d.toISOString().slice(0, 10),
      jam: '',
      therapist_id: '',
    }
  })
}

const EMPTY_FORM: CreateOrderForm = {
  branchId: null,
  patient: null,
  layananId: '',
  harga: '',
  discountPresetLabel: 'Normal',
  customDiscountPct: '',
  dpAmount: '',
  dpMetode: '',
  adminNotes: '',
  startDate: new Date().toISOString().slice(0, 10),
  sessionCount: '1',
  sessions: [],
}

// Draft persistence intentionally excludes decrypted patient name/phone (PII) —
// only the patientId is stored, and the patient record is re-fetched on restore.
type DraftShape = Omit<CreateOrderForm, 'patient'> & { patientId: string | null }

interface UseCreateOrderFormOptions {
  isDirector: boolean
  initialBranchId: string | null
  redirectAfterCreate?: (id: string) => string
}

export function useCreateOrderForm({ isDirector, initialBranchId, redirectAfterCreate }: UseCreateOrderFormOptions) {
  const router = useRouter()

  const [form, setForm] = useState<CreateOrderForm>({ ...EMPTY_FORM, branchId: initialBranchId })
  const [errors, setErrors] = useState<CreateOrderFormErrors>({})
  const [branches, setBranches] = useState<Branch[]>([])
  const [layananOptions, setLayananOptions] = useState<LayananRow[]>([])
  const [therapists, setTherapists] = useState<TherapistOption[]>([])
  const [loadingLayanan, setLoadingLayanan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)

  const hydrating = useRef(true)

  // ── Load branches (director only) ──────────────────────────────────────────
  useEffect(() => {
    if (!isDirector) return
    createClient()
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]))
  }, [isDirector])

  // ── Load therapists once ────────────────────────────────────────────────────
  useEffect(() => {
    fetchTherapistOptions().then(setTherapists)
  }, [])

  // ── Load layanan whenever branch changes ────────────────────────────────────
  useEffect(() => {
    if (!form.branchId) return
    setLoadingLayanan(true)
    fetchLayananByBranch(form.branchId).then((rows) => {
      setLayananOptions(rows.filter((r) => r.is_active))
      setLoadingLayanan(false)
    })
  }, [form.branchId])

  // ── Restore draft from localStorage on mount ────────────────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) { hydrating.current = false; return }
      const draft = JSON.parse(raw) as DraftShape
      const { patientId, ...rest } = draft
      const hydrate = async () => {
        const patient = patientId ? await fetchPatient(patientId) : null
        setForm((f) => ({ ...f, ...rest, branchId: rest.branchId ?? f.branchId, patient }))
        setDraftRestored(true)
        hydrating.current = false
      }
      hydrate()
    } catch {
      hydrating.current = false
    }
  }, [])

  // ── Autosave draft (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (hydrating.current) return
    const t = setTimeout(() => {
      const { patient, ...rest } = form
      const draft: DraftShape = { ...rest, patientId: patient?.id ?? null }
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
      } catch {
        // storage unavailable/full — ignore, draft is a convenience only
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form])

  const field = useCallback(<K extends keyof CreateOrderForm>(key: K, value: CreateOrderForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key === 'harga' ? 'harga' : key === 'layananId' ? 'layanan' : key]: undefined }))
  }, [])

  function selectBranch(branchId: string) {
    setForm((f) => ({ ...f, branchId, layananId: '', harga: '', sessionCount: '1' }))
    setLayananOptions([])
  }

  const selectedLayanan = useMemo(
    () => layananOptions.find((l) => l.id === form.layananId) ?? null,
    [layananOptions, form.layananId],
  )

  function selectLayanan(id: string) {
    const layanan = layananOptions.find((l) => l.id === id) ?? null
    setForm((f) => ({
      ...f,
      layananId: id,
      harga: layanan ? String(layanan.harga) : f.harga,
      sessionCount: layanan?.jumlah_sesi ? String(layanan.jumlah_sesi) : f.sessionCount,
    }))
    setErrors((e) => ({ ...e, layanan: undefined }))
  }

  const discountPct = useMemo(() => {
    const preset = DISCOUNT_PRESETS.find((p) => p.label === form.discountPresetLabel)
    if (!preset) return 0
    if (preset.pct !== null) return preset.pct
    const custom = Number(form.customDiscountPct)
    return isNaN(custom) ? 0 : Math.min(100, Math.max(0, custom))
  }, [form.discountPresetLabel, form.customDiscountPct])

  const hargaNum = useMemo(() => Math.max(0, Number(form.harga) || 0), [form.harga])
  const discountAmount = useMemo(() => Math.round((hargaNum * discountPct) / 100), [hargaNum, discountPct])
  const totalAfterDiscount = useMemo(() => hargaNum - discountAmount, [hargaNum, discountAmount])
  const dpNum = useMemo(() => Math.max(0, Number(form.dpAmount) || 0), [form.dpAmount])

  // ── Session helpers ──────────────────────────────────────────────────────────
  function generateSessions() {
    const count = Math.max(1, Math.min(52, Number(form.sessionCount) || 1))
    setForm((f) => ({ ...f, sessions: buildWeeklySessions(f.startDate, count) }))
    setErrors((e) => ({ ...e, sessions: undefined }))
  }

  function addSessionRow() {
    setForm((f) => ({
      ...f,
      sessions: [
        ...f.sessions,
        {
          key: newSessionKey(),
          session_number: f.sessions.length + 1,
          tanggal: '',
          jam: '',
          therapist_id: '',
        },
      ],
    }))
  }

  function removeSessionRow(key: string) {
    setForm((f) => ({
      ...f,
      sessions: f.sessions
        .filter((s) => s.key !== key)
        .map((s, i) => ({ ...s, session_number: i + 1 })),
    }))
  }

  function updateSessionRow(key: string, patch: Partial<SessionRow>) {
    setForm((f) => ({
      ...f,
      sessions: f.sessions.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }))
    setErrors((e) => ({ ...e, sessions: undefined }))
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: CreateOrderFormErrors = {}
    if (!form.patient) next.patient = 'Pilih pasien terlebih dahulu.'
    if (!form.layananId) next.layanan = 'Pilih layanan terlebih dahulu.'
    if (!form.harga || hargaNum <= 0) next.harga = 'Harga wajib diisi.'
    if (form.discountPresetLabel === 'Custom') {
      const custom = Number(form.customDiscountPct)
      if (form.customDiscountPct === '' || isNaN(custom) || custom < 0 || custom > 100) {
        next.discount = 'Persentase diskon custom harus 0–100.'
      }
    }
    if (dpNum > totalAfterDiscount) next.dp = 'DP tidak boleh melebihi total setelah diskon.'
    if (form.sessions.length === 0) next.sessions = 'Jadwalkan minimal 1 pertemuan.'
    else if (form.sessions.some((s) => !s.tanggal)) next.sessions = 'Setiap pertemuan wajib memiliki tanggal.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit() {
    setSubmitError(null)
    if (!validate()) return
    if (!form.patient) return

    setSaving(true)
    const result = await createOrder({
      patientId: form.patient.id,
      serviceName: selectedLayanan?.nama ?? '',
      harga: hargaNum,
      discountPercentage: discountPct,
      sessions: form.sessions.map((s) => ({
        session_number: s.session_number,
        tanggal: s.tanggal,
        jam: s.jam || null,
        therapist_id: s.therapist_id || null,
      })),
      dpAmount: dpNum,
      dpMetode: form.dpMetode || null,
      adminNotes: form.adminNotes || null,
    })
    setSaving(false)

    if (result.error || !result.id) {
      setSubmitError(result.error ?? 'Gagal membuat order.')
      return
    }

    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      // ignore
    }

    router.push(redirectAfterCreate ? redirectAfterCreate(result.id) : `/order/${result.id}`)
  }

  function selectPatient(patient: PatientPlain | null) {
    setForm((f) => ({ ...f, patient }))
    setErrors((e) => ({ ...e, patient: undefined }))
  }

  return {
    form,
    errors,
    branches,
    layananOptions,
    therapists,
    selectedLayanan,
    loadingLayanan,
    saving,
    submitError,
    draftRestored,
    discountPct,
    hargaNum,
    discountAmount,
    totalAfterDiscount,
    dpNum,
    field,
    selectLayanan,
    selectBranch,
    selectPatient,
    generateSessions,
    addSessionRow,
    removeSessionRow,
    updateSessionRow,
    submit,
  }
}
