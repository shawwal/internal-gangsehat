'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { normalizeBirthDate } from '@/lib/dates'
import { logActivity } from '@/lib/activityLog'
import { addPatient } from '@/app/actions/patients'

const WRITE_ROLES = ['director', 'manager', 'admin']

type SupaClient = Awaited<ReturnType<typeof createClient>>
type AuthOk = { supabase: SupaClient; userId: string; role: string; branchId: string | null }
type AuthResult = AuthOk | { error: string }

async function auth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase
    .from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profil tidak ditemukan' }
  return { supabase, userId: user.id, role: profile.role as string, branchId: profile.branch_id as string | null }
}
async function requireWrite(): Promise<AuthResult> {
  const a = await auth()
  if ('error' in a) return a
  if (!WRITE_ROLES.includes(a.role)) return { error: 'Tidak memiliki akses' }
  return a
}

async function resolveBranch(a: AuthOk): Promise<string | null> {
  if (a.branchId) return a.branchId
  const { data } = await a.supabase
    .from('branches').select('id').ilike('name', '%Griya Anak%').eq('is_active', true).limit(1).maybeSingle()
  return data?.id ?? null
}

function decName(row: { encrypted_name?: string | null; encrypted_phone?: string | null; encrypted_birth_date?: string | null }) {
  try {
    const d = decryptPatientPII({
      encrypted_name: row.encrypted_name ?? '',
      encrypted_phone: row.encrypted_phone ?? '',
      encrypted_birth_date: row.encrypted_birth_date ?? undefined,
    })
    return { name: d.name || 'Anak', phone: d.phone || '', birthDate: normalizeBirthDate(d.birthDate) }
  } catch {
    return { name: 'Anak', phone: '', birthDate: null }
  }
}

// ── search (used by the jadwal assign dialog) ────────────────────────────────

export interface GriyaStudentOption { id: string; name: string; no_rm: string | null }

export async function searchGriyaStudents(term: string, branchId?: string | null): Promise<GriyaStudentOption[]> {
  const q = term.trim().toLowerCase()
  if (q.length < 2) return []
  const supabase = await createClient()

  let bid = branchId ?? null
  if (!bid) {
    const a = await auth()
    if (!('error' in a)) bid = await resolveBranch(a)
  }
  if (!bid) return []

  // Embed patients so the name filter/limit run DB-side — a client-side
  // .in('id', [...1000s]) would blow the PostgREST URL limit.
  const { data } = await supabase
    .from('griya_students')
    .select('patient_id, patients!inner(id, encrypted_name, no_rm, name_normalized)')
    .eq('branch_id', bid)
    .neq('status', 'inactive')
    .ilike('patients.name_normalized', `%${q}%`)
    .limit(25)

  return (data ?? []).map((row) => {
    const p = (row as unknown as { patients: { id: string; encrypted_name: string | null; no_rm: string | null } }).patients
    const dec = decName(p)
    return { id: p.id, name: dec.name, no_rm: p.no_rm ?? null }
  })
}

// ── roster page ─────────────────────────────────────────────────────────────

export interface GriyaStudentRow {
  patient_id: string
  name: string
  phone: string
  gender: string | null
  birthDate: string | null
  keluhan: string | null
  status: string
  activeSlots: number
  createdAt: string
}

export interface GriyaStudentsPage {
  students: GriyaStudentRow[]
  total: number
}

export async function fetchGriyaStudentsPage(params: {
  branchId?: string | null
  page: number
  pageSize: number
  search?: string
  status?: 'all' | 'active' | 'graduated' | 'inactive'
}): Promise<GriyaStudentsPage> {
  const supabase = await createClient()

  let bid = params.branchId ?? null
  if (!bid) {
    const a = await auth()
    if (!('error' in a)) bid = await resolveBranch(a)
  }
  if (!bid) return { students: [], total: 0 }

  const term = params.search?.trim().toLowerCase() ?? ''
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  // Embed patients — filter/sort/paginate DB-side (name_normalized is plaintext).
  let query = supabase
    .from('griya_students')
    .select(
      'patient_id, status, created_at, patients!inner(id, encrypted_name, encrypted_phone, encrypted_birth_date, gender, keluhan, name_normalized)',
      { count: 'exact' },
    )
    .eq('branch_id', bid)
  if (params.status && params.status !== 'all') query = query.eq('status', params.status)
  if (term) query = query.ilike('patients.name_normalized', `%${term}%`)
  query = query.order('created_at', { ascending: true }).range(from, to)

  const { data, count } = await query
  const pageRows = (data ?? []) as unknown as {
    patient_id: string; status: string; created_at: string
    patients: { id: string; encrypted_name: string | null; encrypted_phone: string | null; encrypted_birth_date: string | null; gender: string | null; keluhan: string | null }
  }[]
  if (pageRows.length === 0) return { students: [], total: count ?? 0 }

  const pageIds = pageRows.map((r) => r.patient_id)
  const { data: slots } = await supabase
    .from('griya_schedule_slots')
    .select('patient_id')
    .eq('branch_id', bid)
    .eq('status', 'active')
    .in('patient_id', pageIds)
  const slotCount = new Map<string, number>()
  for (const s of slots ?? []) slotCount.set(s.patient_id as string, (slotCount.get(s.patient_id as string) ?? 0) + 1)

  const students: GriyaStudentRow[] = pageRows.map((r) => {
    const dec = decName(r.patients)
    return {
      patient_id: r.patient_id,
      name: dec.name,
      phone: dec.phone,
      gender: r.patients.gender ?? null,
      birthDate: dec.birthDate,
      keluhan: r.patients.keluhan ?? null,
      status: r.status,
      activeSlots: slotCount.get(r.patient_id) ?? 0,
      createdAt: r.created_at,
    }
  })

  return { students, total: count ?? students.length }
}

// ── student detail ──────────────────────────────────────────────────────────

export interface GriyaStudentSlot {
  id: string
  discipline: string
  hari: string
  slot_time: string
  therapist_name: string
  service_type: string | null
  status: string
  start_date: string
  end_date: string | null
}

export interface GriyaStudentVisit {
  id: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  status: string
  kehadiran: string | null
  notes: string | null
  therapist_name: string | null
}

export interface GriyaStudentDetail {
  found: boolean
  status: string | null
  enrolledAt: string | null
  branchId: string | null
  slots: GriyaStudentSlot[]
  visits: GriyaStudentVisit[]
  stats: { attended: number; absent: number; scheduled: number }
}

function hhmm(t: string | null): string {
  return t ? String(t).slice(0, 5) : ''
}

export async function fetchGriyaStudentDetail(patientId: string): Promise<GriyaStudentDetail> {
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('griya_students')
    .select('status, created_at, branch_id')
    .eq('patient_id', patientId)
    .maybeSingle()

  const branchId = member?.branch_id ?? (await (async () => {
    const a = await auth()
    return 'error' in a ? null : resolveBranch(a)
  })())

  const [slotsRes, visitsRes] = await Promise.all([
    supabase
      .from('griya_schedule_slots')
      .select('id, discipline, hari, slot_time, service_type, status, start_date, end_date, internal_profiles!therapist_id(full_name, nickname)')
      .eq('patient_id', patientId)
      .order('hari', { ascending: true }),
    supabase
      .from('patient_visits')
      .select('id, visit_date, visit_time, service_type, status, kehadiran, notes, internal_profiles!attending_staff_id(full_name, nickname)')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
      .limit(60),
  ])

  const slots: GriyaStudentSlot[] = ((slotsRes.data ?? []) as Record<string, unknown>[]).map((s) => {
    const p = s.internal_profiles as { full_name?: string; nickname?: string | null } | null
    return {
      id: s.id as string,
      discipline: s.discipline as string,
      hari: s.hari as string,
      slot_time: hhmm(s.slot_time as string),
      therapist_name: p?.nickname || p?.full_name || 'Terapis',
      service_type: (s.service_type as string) ?? null,
      status: s.status as string,
      start_date: s.start_date as string,
      end_date: (s.end_date as string) ?? null,
    }
  })

  const visits: GriyaStudentVisit[] = ((visitsRes.data ?? []) as Record<string, unknown>[]).map((v) => {
    const p = v.internal_profiles as { full_name?: string; nickname?: string | null } | null
    return {
      id: v.id as string,
      visit_date: v.visit_date as string,
      visit_time: v.visit_time ? hhmm(v.visit_time as string) : null,
      service_type: (v.service_type as string) ?? null,
      status: v.status as string,
      kehadiran: (v.kehadiran as string) ?? null,
      notes: (v.notes as string) ?? null,
      therapist_name: p?.nickname || p?.full_name || null,
    }
  })

  const stats = {
    attended: visits.filter((v) => v.kehadiran === 'HADIR' || v.status === 'completed').length,
    absent: visits.filter((v) => v.kehadiran === 'TIDAK HADIR' || v.status === 'no_show').length,
    scheduled: visits.filter((v) => v.status === 'scheduled').length,
  }

  return {
    found: !!member,
    status: member?.status ?? null,
    enrolledAt: member?.created_at ?? null,
    branchId,
    slots,
    visits,
    stats,
  }
}

// ── mutations ───────────────────────────────────────────────────────────────

/** Idempotent enrol — used by the jadwal actions and "Tambah Siswa". */
export async function enrollGriyaStudent(
  patientId: string, branchId: string, source = 'manual',
): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { error } = await a.supabase
    .from('griya_students')
    .upsert({ patient_id: patientId, branch_id: branchId, source, created_by: a.userId }, { onConflict: 'patient_id' })
  return { error: error?.message ?? null }
}

/** Create a brand-new child (patient) and enrol them as a Griya student. */
export interface CreateGriyaStudentInput {
  name: string
  phone: string
  gender: 'male' | 'female' | 'other'
  birthDate?: string
  no_rm?: string
  agama?: string
  hobi?: string
  keluhan?: string
  medical_notes?: string
  nama_ibu?: string
  pekerjaan_ibu?: string
  nama_ayah?: string
  pekerjaan_ayah?: string
  sumber?: string
  address?: string
  kelurahan?: string
  kecamatan?: string
  kabupaten_kota?: string
  provinsi?: string
}

export async function createGriyaStudent(
  input: CreateGriyaStudentInput,
  branchId: string,
): Promise<{ error: string | null; id: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error, id: null }

  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name || !phone) return { error: 'Nama dan No. WA wajib diisi.', id: null }

  const t = (v?: string) => (v?.trim() ? v.trim() : undefined)
  const { id, error } = await addPatient({
    name, phone, gender: input.gender,
    birthDate: t(input.birthDate),
    no_rm: t(input.no_rm),
    agama: t(input.agama),
    hobi: t(input.hobi),
    keluhan: t(input.keluhan),
    medical_notes: t(input.medical_notes),
    nama_ibu: t(input.nama_ibu),
    pekerjaan_ibu: t(input.pekerjaan_ibu),
    nama_ayah: t(input.nama_ayah),
    pekerjaan_ayah: t(input.pekerjaan_ayah),
    sumber: t(input.sumber),
    address: t(input.address),
    kelurahan: t(input.kelurahan),
    kecamatan: t(input.kecamatan),
    kabupaten_kota: t(input.kabupaten_kota),
    provinsi: t(input.provinsi),
  })
  if (error || !id) return { error: error ?? 'Gagal menambah anak.', id: null }

  const { error: enrollErr } = await enrollGriyaStudent(id, branchId, 'manual')
  if (enrollErr) return { error: enrollErr, id }
  return { error: null, id }
}

export async function setGriyaStudentStatus(
  patientId: string, status: 'active' | 'graduated' | 'inactive',
): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { error } = await a.supabase
    .from('griya_students').update({ status }).eq('patient_id', patientId)
  if (!error) {
    await logActivity({
      supabase: a.supabase, userId: a.userId, action: 'update', resourceType: 'griya_slot',
      resourceId: patientId, newValues: { student_status: status },
    })
  }
  return { error: error?.message ?? null }
}

export async function removeGriyaStudent(patientId: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { count } = await a.supabase
    .from('griya_schedule_slots')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('status', 'active')
  if ((count ?? 0) > 0) return { error: 'Masih ada jadwal aktif — akhiri jadwalnya dulu.' }
  const { error } = await a.supabase.from('griya_students').delete().eq('patient_id', patientId)
  return { error: error?.message ?? null }
}
