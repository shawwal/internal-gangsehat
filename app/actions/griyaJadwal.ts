'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { generateOrderId } from '@/lib/internal/orderId'
import { logActivity } from '@/lib/activityLog'
import { SERVICE_TYPES } from '@/lib/serviceType'
import { resolveTherapistForSlot } from '@/lib/griyaRotation'

// ── Shared types ──────────────────────────────────────────────────────────────

export type Discipline = 'FISIOTERAPI' | 'TERAPI_WICARA' | 'TERAPI_PERILAKU' | 'PSIKOLOG'
export type Hari = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'AHAD'
export type SlotStatus = 'active' | 'graduated' | 'stopped' | 'paused'
export type AbsenceReason = 'SAKIT' | 'IZIN' | 'ALPA' | 'LIBUR'

export interface GriyaTherapist {
  id: string
  therapist_id: string
  full_name: string
  nickname: string | null
  avatar_url: string | null
  discipline: Discipline
  display_order: number
  is_active: boolean
}

export interface GriyaSlot {
  id: string
  patient_id: string
  patient_name: string
  therapist_id: string | null   // legacy — informational only, never authoritative (see lib/griyaRotation.ts)
  discipline: Discipline
  hari: Hari
  slot_time: string          // 'HH:MM'
  service_type: string | null
  package_id: string | null
  start_date: string
  end_date: string | null
  status: SlotStatus
  notes: string | null
}

export interface GriyaWeekVisit {
  id: string
  patient_id: string
  patient_name: string
  patient_phone: string
  griya_slot_id: string | null
  attending_staff_id: string | null
  visit_date: string         // ISO
  visit_time: string | null  // 'HH:MM'
  service_type: string | null
  status: string
  kehadiran: string | null
  notes: string | null
  package_id: string | null
}

export interface GriyaScheduleRow {
  staff_id: string
  hari: string
  jam_mulai: string          // 'HH:MM'
  jam_selesai: string        // 'HH:MM'
}

export interface GriyaWeek {
  branchId: string | null
  therapists: GriyaTherapist[]
  slots: GriyaSlot[]
  visits: GriyaWeekVisit[]
  schedules: GriyaScheduleRow[]
}

const WRITE_ROLES = ['director', 'manager', 'admin']

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function hhmm(t: string | null): string | null {
  return t ? String(t).slice(0, 5) : null
}

type SupaClient = Awaited<ReturnType<typeof createClient>>
type AuthOk = { supabase: SupaClient; userId: string; role: string; branchId: string | null }
type AuthResult = AuthOk | { error: string }

async function auth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { error: 'Profil tidak ditemukan' }
  return { supabase, userId: user.id, role: profile.role as string, branchId: profile.branch_id as string | null }
}

async function requireWrite(): Promise<AuthResult> {
  const a = await auth()
  if ('error' in a) return a
  if (!WRITE_ROLES.includes(a.role)) return { error: 'Tidak memiliki akses' }
  return a
}

/** Ensure a child is on the Griya Anak roster (idempotent). Best-effort. */
async function ensureEnrolled(a: AuthOk, patientId: string, branchId: string, source: string) {
  await a.supabase
    .from('griya_students')
    .upsert({ patient_id: patientId, branch_id: branchId, source, created_by: a.userId }, { onConflict: 'patient_id', ignoreDuplicates: true })
}

/** Resolves the Griya Anak branch id — the caller's own branch, or (for a
 *  director) the branch named "Griya Anak". */
export async function resolveGriyaBranchId(): Promise<string | null> {
  const a = await auth()
  if ('error' in a) return null
  if (a.branchId) return a.branchId
  const { data } = await a.supabase
    .from('branches')
    .select('id')
    .ilike('name', '%Griya Anak%')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

// ── Fetch a week ──────────────────────────────────────────────────────────────

export async function fetchGriyaWeek(weekMondayIso: string, branchId: string): Promise<GriyaWeek> {
  const supabase = await createClient()
  const weekEndIso = addDaysIso(weekMondayIso, 6)

  const [therapistsRes, slotsRes, visitsRes, schedulesRes] = await Promise.all([
    supabase
      .from('griya_therapists')
      .select('id, therapist_id, discipline, display_order, is_active, internal_profiles!therapist_id(full_name, nickname, avatar_url)')
      .eq('branch_id', branchId)
      .order('display_order', { ascending: true }),
    supabase
      .from('griya_schedule_slots')
      .select('id, patient_id, therapist_id, discipline, hari, slot_time, service_type, package_id, start_date, end_date, status, notes')
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .lte('start_date', weekEndIso)
      .or(`end_date.is.null,end_date.gte.${weekMondayIso}`),
    supabase
      .from('patient_visits')
      .select('id, patient_id, griya_slot_id, attending_staff_id, visit_date, visit_time, service_type, status, kehadiran, notes, package_id')
      .eq('branch_id', branchId)
      .gte('visit_date', weekMondayIso)
      .lte('visit_date', weekEndIso),
    supabase
      .from('schedules')
      .select('staff_id, hari, jam_mulai, jam_selesai, status')
      .eq('branch_id', branchId)
      .eq('status', 'AKTIF'),
  ])

  const slots = (slotsRes.data ?? []) as Record<string, unknown>[]
  const visits = ((visitsRes.data ?? []) as Record<string, unknown>[]).filter(
    (v) => v.griya_slot_id != null || (SERVICE_TYPES as string[]).includes((v.service_type as string) ?? ''),
  )

  // Batch-decrypt patient names for every patient referenced by a slot or visit
  const patientIds = [...new Set([
    ...slots.map((s) => s.patient_id as string),
    ...visits.map((v) => v.patient_id as string),
  ])]
  const nameMap = new Map<string, string>()
  const phoneMap = new Map<string, string>()
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, encrypted_name, encrypted_phone')
      .in('id', patientIds)
    for (const p of patients ?? []) {
      try {
        const dec = decryptPatientPII({
          encrypted_name: p.encrypted_name ?? '',
          encrypted_phone: p.encrypted_phone ?? '',
        })
        nameMap.set(p.id, dec.name || 'Anak')
        phoneMap.set(p.id, dec.phone || '')
      } catch {
        nameMap.set(p.id, 'Anak')
        phoneMap.set(p.id, '')
      }
    }
  }

  const therapists: GriyaTherapist[] = ((therapistsRes.data ?? []) as Record<string, unknown>[]).map((t) => {
    const p = t.internal_profiles as { full_name?: string; nickname?: string | null; avatar_url?: string | null } | null
    return {
      id: t.id as string,
      therapist_id: t.therapist_id as string,
      full_name: p?.full_name ?? 'Terapis',
      nickname: p?.nickname ?? null,
      avatar_url: p?.avatar_url ?? null,
      discipline: t.discipline as Discipline,
      display_order: t.display_order as number,
      is_active: t.is_active as boolean,
    }
  })

  return {
    branchId,
    therapists,
    slots: slots.map((s) => ({
      id: s.id as string,
      patient_id: s.patient_id as string,
      patient_name: nameMap.get(s.patient_id as string) ?? 'Anak',
      therapist_id: (s.therapist_id as string) ?? null,
      discipline: s.discipline as Discipline,
      hari: s.hari as Hari,
      slot_time: hhmm(s.slot_time as string) ?? '08:00',
      service_type: (s.service_type as string) ?? null,
      package_id: (s.package_id as string) ?? null,
      start_date: s.start_date as string,
      end_date: (s.end_date as string) ?? null,
      status: s.status as SlotStatus,
      notes: (s.notes as string) ?? null,
    })),
    visits: visits.map((v) => ({
      id: v.id as string,
      patient_id: v.patient_id as string,
      patient_name: nameMap.get(v.patient_id as string) ?? 'Anak',
      patient_phone: phoneMap.get(v.patient_id as string) ?? '',
      griya_slot_id: (v.griya_slot_id as string) ?? null,
      attending_staff_id: (v.attending_staff_id as string) ?? null,
      visit_date: v.visit_date as string,
      visit_time: hhmm(v.visit_time as string),
      service_type: (v.service_type as string) ?? null,
      status: v.status as string,
      kehadiran: (v.kehadiran as string) ?? null,
      notes: (v.notes as string) ?? null,
      package_id: (v.package_id as string) ?? null,
    })),
    schedules: ((schedulesRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      staff_id: r.staff_id as string,
      hari: r.hari as string,
      jam_mulai: hhmm(r.jam_mulai as string) ?? '08:00',
      jam_selesai: hhmm(r.jam_selesai as string) ?? '17:00',
    })),
  }
}

// ── Assign a recurring MASTER slot — Day + Time + Patient + Service only, no
// therapist (the therapist is resolved daily by rotation, see lib/griyaRotation.ts) ─

export interface AssignSlotInput {
  branch_id: string
  patient_id: string
  discipline: Discipline
  hari: Hari
  slot_time: string          // 'HH:MM'
  service_type?: string | null
  package_id?: string | null
  start_date: string         // ISO
  notes?: string | null
}

export async function assignRecurringSlot(input: AssignSlotInput): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  await ensureEnrolled(a, input.patient_id, input.branch_id, 'jadwal')

  const { data, error } = await supabase.from('griya_schedule_slots').insert({
    branch_id: input.branch_id,
    patient_id: input.patient_id,
    discipline: input.discipline,
    hari: input.hari,
    slot_time: input.slot_time,
    service_type: input.service_type ?? null,
    package_id: input.package_id ?? null,
    start_date: input.start_date,
    notes: input.notes ?? null,
    created_by: userId,
  }).select('id').single()

  if (error) {
    if (error.code === '23505') return { error: 'Anak ini sudah memiliki jadwal tetap di hari dan jam yang sama.' }
    return { error: error.message }
  }

  await logActivity({
    supabase, userId, action: 'create', resourceType: 'griya_slot',
    resourceId: data?.id, branchId: input.branch_id,
    newValues: { hari: input.hari, slot_time: input.slot_time, discipline: input.discipline },
  })
  return { error: null }
}

// ── Edit a MASTER slot's day/time/service (never the therapist — there isn't one) ─

export interface UpdateMasterSlotInput {
  slotId: string
  hari: Hari
  slot_time: string
  discipline: Discipline
  service_type?: string | null
  package_id?: string | null
}

export async function updateMasterSlot(input: UpdateMasterSlotInput): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots').select('branch_id, hari, slot_time').eq('id', input.slotId).single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const { error } = await supabase
    .from('griya_schedule_slots')
    .update({
      hari: input.hari,
      slot_time: input.slot_time,
      discipline: input.discipline,
      service_type: input.service_type ?? null,
      package_id: input.package_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.slotId)

  if (error) {
    if (error.code === '23505') return { error: 'Anak ini sudah memiliki jadwal tetap di hari dan jam yang sama.' }
    return { error: error.message }
  }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'griya_slot', resourceId: input.slotId,
    branchId: slot.branch_id as string,
    oldValues: { hari: slot.hari, slot_time: hhmm(slot.slot_time as string) },
    newValues: { hari: input.hari, slot_time: input.slot_time, discipline: input.discipline },
  })
  return { error: null }
}

// ── Full list of a branch's master schedule rows (not week-scoped — used by the
// Jadwal Master page, a plain table rather than the therapist-column grid) ────

export async function fetchGriyaMasterSchedule(branchId: string): Promise<GriyaSlot[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('griya_schedule_slots')
    .select('id, patient_id, therapist_id, discipline, hari, slot_time, service_type, package_id, start_date, end_date, status, notes')
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .order('hari').order('slot_time')

  const rows = (data ?? []) as Record<string, unknown>[]
  const patientIds = [...new Set(rows.map((r) => r.patient_id as string))]
  const nameMap = new Map<string, string>()
  if (patientIds.length > 0) {
    const { data: patients } = await supabase.from('patients').select('id, encrypted_name').in('id', patientIds)
    for (const p of patients ?? []) {
      try { nameMap.set(p.id, decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: '' }).name || 'Anak') }
      catch { nameMap.set(p.id, 'Anak') }
    }
  }

  return rows.map((s) => ({
    id: s.id as string,
    patient_id: s.patient_id as string,
    patient_name: nameMap.get(s.patient_id as string) ?? 'Anak',
    therapist_id: (s.therapist_id as string) ?? null,
    discipline: s.discipline as Discipline,
    hari: s.hari as Hari,
    slot_time: hhmm(s.slot_time as string) ?? '08:00',
    service_type: (s.service_type as string) ?? null,
    package_id: (s.package_id as string) ?? null,
    start_date: s.start_date as string,
    end_date: (s.end_date as string) ?? null,
    status: s.status as SlotStatus,
    notes: (s.notes as string) ?? null,
  }))
}

// ── Reassign one occurrence of a master slot to a specific therapist/time, for a
// single date only — the master row (griya_schedule_slots) is never touched. ──

export interface MoveSlotInput {
  slotId: string
  therapist_id: string
  slot_time: string
  date: string
}

export async function moveSlot(input: MoveSlotInput): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots')
    .select('id, branch_id, patient_id, service_type, package_id')
    .eq('id', input.slotId)
    .single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const { data: existing } = await supabase
    .from('patient_visits')
    .select('id')
    .eq('griya_slot_id', input.slotId)
    .eq('visit_date', input.date)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('patient_visits')
      .update({
        attending_staff_id: input.therapist_id,
        visit_time: input.slot_time,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return { error: error?.message ?? null }
  }

  const orderId = await generateOrderId(supabase)
  const { error } = await supabase.from('patient_visits').insert({
    griya_slot_id: input.slotId,
    patient_id: slot.patient_id as string,
    branch_id: slot.branch_id as string,
    attending_staff_id: input.therapist_id,
    visit_date: input.date,
    visit_time: input.slot_time,
    service_type: (slot.service_type as string) ?? 'SESI TERAPI',
    package_id: (slot.package_id as string) ?? null,
    status: 'scheduled',
    order_id: orderId,
    updated_at: new Date().toISOString(),
  })
  return { error: error?.message ?? null }
}

// ── Mark attendance for one occurrence ───────────────────────────────────────

export async function markAttendance(
  slotId: string,
  date: string,
  input: { present: boolean; reason?: AbsenceReason | null },
): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots')
    .select('branch_id, patient_id, discipline, hari, service_type, slot_time, package_id')
    .eq('id', slotId)
    .single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const { data: existing } = await supabase
    .from('patient_visits')
    .select('id, visit_time')
    .eq('griya_slot_id', slotId)
    .eq('visit_date', date)
    .maybeSingle()

  // Resolving who's actually on duty is only needed the first time this occurrence
  // is materialized (an existing row already has attending_staff_id set).
  let resolvedTherapistId: string | null = null
  if (!existing) {
    const [{ data: therapists }, { data: schedules }] = await Promise.all([
      supabase.from('griya_therapists').select('therapist_id, discipline, display_order, is_active').eq('branch_id', slot.branch_id).eq('is_active', true),
      supabase.from('schedules').select('staff_id, hari, jam_mulai, jam_selesai').eq('branch_id', slot.branch_id).eq('status', 'AKTIF').eq('hari', slot.hari as string),
    ])
    resolvedTherapistId = resolveTherapistForSlot(
      { discipline: slot.discipline as Discipline, hari: slot.hari as string, slot_time: hhmm(slot.slot_time as string) ?? '' },
      (therapists ?? []) as { therapist_id: string; discipline: Discipline; display_order: number; is_active: boolean }[],
      (schedules ?? []) as { staff_id: string; hari: string; jam_mulai: string; jam_selesai: string }[],
    )
  }

  const patch = input.present
    ? { kehadiran: 'HADIR', status: 'completed', notes: null as string | null }
    : {
        kehadiran: 'TIDAK HADIR',
        status: input.reason === 'ALPA' ? 'no_show' : 'cancelled',
        notes: input.reason ?? 'IZIN',
      }
  // keep every session (attended or not) linked to the slot's package so the
  // student's package history shows it — the stats view still only counts HADIR.
  const pkg = (slot.package_id as string) ?? null

  if (existing) {
    const { error } = await supabase
      .from('patient_visits')
      .update({ ...patch, ...(pkg ? { package_id: pkg } : {}), updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const orderId = await generateOrderId(supabase)
    const { error } = await supabase.from('patient_visits').insert({
      griya_slot_id: slotId,
      patient_id: slot.patient_id as string,
      branch_id: slot.branch_id as string,
      attending_staff_id: resolvedTherapistId,
      visit_date: date,
      visit_time: hhmm(slot.slot_time as string),
      service_type: (slot.service_type as string) ?? 'SESI TERAPI',
      package_id: pkg,
      order_id: orderId,
      updated_at: new Date().toISOString(),
      ...patch,
    })
    if (error) return { error: error.message }
  }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'griya_slot', resourceId: slotId,
    branchId: slot.branch_id as string,
    newValues: { date, kehadiran: patch.kehadiran, reason: input.present ? null : (input.reason ?? 'IZIN') },
  })
  return { error: null }
}

// ── Undo an accidental attendance mark (Hadir/Tidak Hadir → back to Terjadwal) ─

export async function resetAttendance(slotId: string, date: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots').select('branch_id').eq('id', slotId).single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const { data: existing } = await supabase
    .from('patient_visits')
    .select('id')
    .eq('griya_slot_id', slotId)
    .eq('visit_date', date)
    .maybeSingle()
  if (!existing) return { error: null } // nothing marked yet — nothing to undo

  const { count: paidCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', existing.id)
    .eq('status', 'confirmed')
  if ((paidCount ?? 0) > 0) {
    return { error: 'Kunjungan ini sudah punya pembayaran terkonfirmasi — batalkan pembayarannya dulu sebelum membatalkan kehadiran.' }
  }

  const { error } = await supabase
    .from('patient_visits')
    .update({ kehadiran: null, status: 'scheduled', notes: null, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'griya_slot', resourceId: slotId,
    branchId: slot.branch_id as string,
    newValues: { date, kehadiran: null, reset: true },
  })
  return { error: null }
}

// ── Add a substitute into a freed cell for one week ──────────────────────────

export interface AddSubstituteInput {
  branch_id: string
  patient_id: string
  therapist_id: string
  date: string
  slot_time: string
  service_type?: string | null
  package_id?: string | null
  coveringName?: string | null
}

export async function addSubstitute(input: AddSubstituteInput): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  await ensureEnrolled(a, input.patient_id, input.branch_id, 'jadwal')

  const orderId = await generateOrderId(supabase)
  const { error } = await supabase.from('patient_visits').insert({
    patient_id: input.patient_id,
    branch_id: input.branch_id,
    attending_staff_id: input.therapist_id,
    visit_date: input.date,
    visit_time: input.slot_time,
    service_type: input.service_type ?? 'SESI TERAPI',
    package_id: input.package_id ?? null,
    status: 'scheduled',
    griya_slot_id: null,
    notes: input.coveringName ? `Pengganti untuk ${input.coveringName}` : 'Pengganti',
    order_id: orderId,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'create', resourceType: 'griya_slot', resourceId: null,
    branchId: input.branch_id,
    newValues: { substitute: true, date: input.date, therapist_id: input.therapist_id, slot_time: input.slot_time },
  })
  return { error: null }
}

// ── End an enrolment ────────────────────────────────────────────────────────

export async function endEnrollment(
  slotId: string,
  input: { status: 'graduated' | 'stopped'; end_date: string },
): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots').select('branch_id, status, end_date').eq('id', slotId).single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const { error } = await supabase
    .from('griya_schedule_slots')
    .update({ status: input.status, end_date: input.end_date })
    .eq('id', slotId)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'griya_slot', resourceId: slotId,
    branchId: slot.branch_id as string,
    oldValues: { status: slot.status, end_date: slot.end_date },
    newValues: { status: input.status, end_date: input.end_date },
  })
  return { error: null }
}

// ── Remove a slot created by mistake (only if it has no realised visits) ─────

export async function removeSlot(slotId: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { count } = await supabase
    .from('patient_visits')
    .select('id', { count: 'exact', head: true })
    .eq('griya_slot_id', slotId)
  if ((count ?? 0) > 0) {
    return { error: 'Slot ini sudah punya riwayat kehadiran — akhiri jadwal, jangan hapus.' }
  }

  const { data: slot } = await supabase
    .from('griya_schedule_slots').select('branch_id, hari, slot_time').eq('id', slotId).single()

  const { error } = await supabase.from('griya_schedule_slots').delete().eq('id', slotId)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'delete', resourceType: 'griya_slot', resourceId: slotId,
    branchId: (slot?.branch_id as string) ?? null,
    oldValues: slot ? { hari: slot.hari, slot_time: hhmm(slot.slot_time as string) } : null,
  })
  return { error: null }
}

// ── Therapist column management ──────────────────────────────────────────────

export interface BranchStaffOption { id: string; full_name: string; nickname: string | null }

export async function fetchGriyaTherapistCandidates(branchId: string): Promise<BranchStaffOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_profiles')
    .select('id, full_name, nickname')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .in('role', ['therapist', 'staff', 'manager'])
    .order('full_name')
  return (data ?? []) as BranchStaffOption[]
}

export async function upsertGriyaTherapist(input: {
  id?: string
  branch_id: string
  therapist_id: string
  discipline: Discipline
  display_order: number
  is_active?: boolean
}): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    branch_id: input.branch_id,
    therapist_id: input.therapist_id,
    discipline: input.discipline,
    display_order: input.display_order,
    is_active: input.is_active ?? true,
  }
  const { error } = await a.supabase
    .from('griya_therapists')
    .upsert(payload, { onConflict: 'branch_id,therapist_id' })
  return { error: error?.message ?? null }
}

export async function removeGriyaTherapist(id: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { error } = await a.supabase.from('griya_therapists').delete().eq('id', id)
  return { error: error?.message ?? null }
}
