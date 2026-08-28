'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { normalizeBirthDate } from '@/lib/dates'
import { logActivity } from '@/lib/activityLog'

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

  const { data: members } = await supabase
    .from('griya_students').select('patient_id').eq('branch_id', bid).neq('status', 'inactive')
  const ids = (members ?? []).map((m) => m.patient_id)
  if (ids.length === 0) return []

  const { data } = await supabase
    .from('patients')
    .select('id, encrypted_name, no_rm, name_normalized')
    .in('id', ids)
    .ilike('name_normalized', `%${q}%`)
    .order('name_normalized')
    .limit(25)

  return (data ?? []).map((p) => {
    const dec = decName(p)
    return { id: p.id as string, name: dec.name, no_rm: (p.no_rm as string | null) ?? null }
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

  // membership rows for this branch
  let mq = supabase.from('griya_students').select('patient_id, status, created_at').eq('branch_id', bid)
  if (params.status && params.status !== 'all') mq = mq.eq('status', params.status)
  const { data: members } = await mq
  let rows = (members ?? []) as { patient_id: string; status: string; created_at: string }[]
  if (rows.length === 0) return { students: [], total: 0 }

  const ids = rows.map((r) => r.patient_id)

  // decrypt names (+ optional name search)
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone, encrypted_birth_date, gender, keluhan, name_normalized')
    .in('id', ids)

  const term = params.search?.trim().toLowerCase() ?? ''
  const pMap = new Map<string, GriyaStudentRow>()
  for (const p of patients ?? []) {
    if (term && !String(p.name_normalized ?? '').includes(term)) continue
    const dec = decName(p)
    pMap.set(p.id as string, {
      patient_id: p.id as string,
      name: dec.name,
      phone: dec.phone,
      gender: (p.gender as string | null) ?? null,
      birthDate: dec.birthDate,
      keluhan: (p.keluhan as string | null) ?? null,
      status: 'active',
      activeSlots: 0,
      createdAt: '',
    })
  }

  // active slot counts
  const { data: slots } = await supabase
    .from('griya_schedule_slots')
    .select('patient_id')
    .eq('branch_id', bid)
    .eq('status', 'active')
    .in('patient_id', ids)
  const slotCount = new Map<string, number>()
  for (const s of slots ?? []) slotCount.set(s.patient_id as string, (slotCount.get(s.patient_id as string) ?? 0) + 1)

  rows = rows.filter((r) => pMap.has(r.patient_id))
  const merged = rows.map((r) => {
    const base = pMap.get(r.patient_id)!
    return { ...base, status: r.status, createdAt: r.created_at, activeSlots: slotCount.get(r.patient_id) ?? 0 }
  })
  merged.sort((a, b) => a.name.localeCompare(b.name, 'id'))

  const from = (params.page - 1) * params.pageSize
  return { students: merged.slice(from, from + params.pageSize), total: merged.length }
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
