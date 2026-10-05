'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { generateOrderId } from '@/lib/internal/orderId'
import { logActivity } from '@/lib/activityLog'
import { SERVICE_TYPES } from '@/lib/serviceType'
import { resolveTherapistForSlot } from '@/lib/griyaRotation'
import { resolveDay, isBusyCell } from '@/components/griya/resolve'

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
  patient_phone?: string        // decrypted; only set by fetchGriyaWeek (WA reminders)
  therapist_id: string | null   // optional pin (set from jadwal harian) — overrides daily rotation when still valid (see lib/griyaRotation.ts)
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
  layanan_id: string | null
}

export interface GriyaScheduleRow {
  staff_id: string
  hari: string
  jam_mulai: string          // 'HH:MM'
  jam_selesai: string        // 'HH:MM'
  status: string             // 'AKTIF' | 'OFF'
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

// A concurrent double-click/double-submit on "Pindahkan"/"Tandai Hadir" etc. can
// race the classic check-then-insert pattern below and leave two patient_visits
// rows for the same (griya_slot_id, visit_date) — after which `.maybeSingle()`
// errors out (silently, since callers only destructure `data`), that error is
// swallowed, `existing` reads back as null, and every future action for that
// occurrence takes the "insert new" branch instead of "update" — creating yet
// another duplicate each time, which is exactly what showed up as the same
// student's name appearing twice on jadwal mingguan. This looks up defensively:
// if it ever finds more than one row, it keeps the oldest and deletes the rest.
async function findVisitForSlotDate(supabase: SupaClient, slotId: string, date: string): Promise<{ id: string } | null> {
  const { data: rows } = await supabase
    .from('patient_visits')
    .select('id')
    .eq('griya_slot_id', slotId)
    .eq('visit_date', date)
    .order('created_at', { ascending: true })
  if (!rows || rows.length === 0) return null
  if (rows.length > 1) {
    await supabase.from('patient_visits').delete().in('id', rows.slice(1).map((r) => r.id as string))
  }
  return { id: rows[0].id as string }
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

async function readBranchSchedules(supabase: SupaClient, branchId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }
  const { data: profile } = await supabase
    .from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile || (profile.role !== 'director' && profile.branch_id !== branchId)) return { data: [] }
  return createAdminClient()
    .from('schedules')
    .select('staff_id, hari, jam_mulai, jam_selesai, status')
    .eq('branch_id', branchId)
}

const SLOT_COLS = 'id, patient_id, therapist_id, discipline, hari, slot_time, service_type, package_id, start_date, end_date, status, notes'
const VISIT_COLS = 'id, patient_id, griya_slot_id, attending_staff_id, visit_date, visit_time, service_type, status, kehadiran, notes, package_id, layanan_id'

type Row = Record<string, unknown>

/** The raw rows behind one week of the grid (visits optionally narrowed to a
 *  range of that week). Shared by fetchGriyaWeek and isCellOccupied so the
 *  server's "is this cell taken" check always sees exactly what the grid renders. */
async function loadGriyaWeekRows(
  supabase: SupaClient, branchId: string, weekMondayIso: string,
  visitRange?: { from: string; to: string },
) {
  const weekEndIso = addDaysIso(weekMondayIso, 6)
  const [therapistsRes, slotsRes, visitsRes, schedulesRes] = await Promise.all([
    supabase
      .from('griya_therapists')
      .select('id, therapist_id, discipline, display_order, is_active')
      .eq('branch_id', branchId)
      .order('display_order', { ascending: true }),
    // Active open-ended slots, plus any slot (active or ended) whose end_date falls
    // in/after this week — an ended slot's past occurrences (hadir/izin) must still
    // render on the weeks before it ended, otherwise ending a schedule made its
    // attendance history vanish from the grid. resolveDay() enforces the
    // start_date/end_date window per day.
    supabase
      .from('griya_schedule_slots')
      .select(SLOT_COLS)
      .eq('branch_id', branchId)
      .lte('start_date', weekEndIso)
      .or(`and(status.eq.active,end_date.is.null),end_date.gte.${weekMondayIso}`),
    supabase
      .from('patient_visits')
      .select(VISIT_COLS)
      .eq('branch_id', branchId)
      .gte('visit_date', visitRange?.from ?? weekMondayIso)
      .lte('visit_date', visitRange?.to ?? weekEndIso),
    // Therapist/staff roles can only SELECT their own `schedules` rows (RLS "self access"),
    // so rotation saw only the viewer on duty and piled every slot of their discipline into
    // their column. Read the branch's rolling schedule with the admin client instead, but
    // only for a signed-in user of this branch (or a cross-branch director).
    readBranchSchedules(supabase, branchId),
  ])

  return {
    therapistRows: (therapistsRes.data ?? []) as Row[],
    slots: (slotsRes.data ?? []) as Row[],
    visits: ((visitsRes.data ?? []) as Row[]).filter(
      (v) => v.griya_slot_id != null || (SERVICE_TYPES as string[]).includes((v.service_type as string) ?? ''),
    ),
    schedules: ((schedulesRes.data ?? []) as Row[]).map((r): GriyaScheduleRow => ({
      staff_id: r.staff_id as string,
      hari: r.hari as string,
      jam_mulai: hhmm(r.jam_mulai as string) ?? '08:00',
      jam_selesai: hhmm(r.jam_selesai as string) ?? '17:00',
      status: r.status as string,
    })),
  }
}

function toGriyaTherapist(t: Row, p: { full_name?: string; nickname?: string | null; avatar_url?: string | null } | null): GriyaTherapist {
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
}

function toGriyaSlot(s: Row, name: string, phone?: string): GriyaSlot {
  return {
    id: s.id as string,
    patient_id: s.patient_id as string,
    patient_name: name,
    ...(phone !== undefined ? { patient_phone: phone } : {}),
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
  }
}

function toGriyaVisit(v: Row, name: string, phone: string): GriyaWeekVisit {
  return {
    id: v.id as string,
    patient_id: v.patient_id as string,
    patient_name: name,
    patient_phone: phone,
    griya_slot_id: (v.griya_slot_id as string) ?? null,
    attending_staff_id: (v.attending_staff_id as string) ?? null,
    visit_date: v.visit_date as string,
    visit_time: hhmm(v.visit_time as string),
    service_type: (v.service_type as string) ?? null,
    status: v.status as string,
    kehadiran: (v.kehadiran as string) ?? null,
    notes: (v.notes as string) ?? null,
    package_id: (v.package_id as string) ?? null,
    layanan_id: (v.layanan_id as string) ?? null,
  }
}

export async function fetchGriyaWeek(weekMondayIso: string, branchId: string): Promise<GriyaWeek> {
  const supabase = await createClient()
  const { therapistRows, slots, visits, schedules } = await loadGriyaWeekRows(supabase, branchId, weekMondayIso)

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

  // Therapist/staff roles can only SELECT their own internal_profiles row (RLS), so an
  // embedded join showed every other column as a blank "Terapis". The roster itself was
  // already scoped by RLS on griya_therapists, so read just these display fields with the
  // admin client for exactly those ids.
  type ProfileLite = { full_name?: string; nickname?: string | null; avatar_url?: string | null }
  const profileMap = new Map<string, ProfileLite>()
  if (therapistRows.length > 0) {
    const { data: profs } = await createAdminClient()
      .from('internal_profiles')
      .select('id, full_name, nickname, avatar_url')
      .in('id', therapistRows.map((t) => t.therapist_id as string))
    for (const pr of profs ?? []) profileMap.set(pr.id, pr)
  }

  return {
    branchId,
    therapists: therapistRows.map((t) => toGriyaTherapist(t, profileMap.get(t.therapist_id as string) ?? null)),
    slots: slots.map((s) => toGriyaSlot(s, nameMap.get(s.patient_id as string) ?? 'Anak', phoneMap.get(s.patient_id as string) ?? '')),
    visits: visits.map((v) => toGriyaVisit(v, nameMap.get(v.patient_id as string) ?? 'Anak', phoneMap.get(v.patient_id as string) ?? '')),
    schedules,
  }
}

// ── Detect a recurring double-booking before it happens: two active slots at the
// same discipline+hari+slot_time that would resolve (via pin or rotation) to the
// very same therapist — the exact scenario that used to make one of them silently
// disappear from jadwal harian (see components/griya/DayGrid.tsx). ─────────────

async function findSlotCollision(
  supabase: SupaClient, branchId: string, discipline: Discipline, hari: Hari, slotTime: string,
  therapistIdPin: string | null | undefined, excludeSlotId?: string,
): Promise<string | null> {
  const [{ data: existingSlots }, { data: therapistRows }, { data: scheduleRows }] = await Promise.all([
    supabase.from('griya_schedule_slots')
      .select('id, patient_id, therapist_id')
      .eq('branch_id', branchId).eq('discipline', discipline).eq('hari', hari).eq('slot_time', slotTime).eq('status', 'active'),
    supabase.from('griya_therapists')
      .select('therapist_id, discipline, display_order, is_active')
      .eq('branch_id', branchId).eq('is_active', true),
    // same source as the grid (fetchGriyaWeek) — rotation must resolve identically
    readBranchSchedules(supabase, branchId),
  ])

  const therapists = (therapistRows ?? []) as { therapist_id: string; discipline: Discipline; display_order: number; is_active: boolean }[]
  const schedules = ((scheduleRows ?? []) as { staff_id: string; hari: string; jam_mulai: string; jam_selesai: string; status: string }[])
    .filter((r) => r.hari === hari && r.status === 'AKTIF')

  const newResolved = resolveTherapistForSlot({ discipline, hari, slot_time: slotTime, therapist_id: therapistIdPin ?? null }, therapists, schedules)
  if (!newResolved) return null // nobody on duty — surfaces as "Unassigned", not a collision

  for (const s of existingSlots ?? []) {
    if (s.id === excludeSlotId) continue
    const existingResolved = resolveTherapistForSlot(
      { discipline, hari, slot_time: slotTime, therapist_id: s.therapist_id as string | null }, therapists, schedules,
    )
    if (existingResolved === newResolved) {
      const { data: patient } = await supabase.from('patients').select('encrypted_name').eq('id', s.patient_id as string).single()
      let name = 'anak lain'
      if (patient?.encrypted_name) {
        try { name = decryptPatientPII({ encrypted_name: patient.encrypted_name, encrypted_phone: '' }).name || name }
        catch { /* keep fallback */ }
      }
      return name
    }
  }
  return null
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
  therapist_id?: string | null  // pin a specific therapist instead of daily rotation (jadwal harian only)
}

export async function assignRecurringSlot(input: AssignSlotInput): Promise<{ error: string | null; id?: string }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const collidingWith = await findSlotCollision(
    supabase, input.branch_id, input.discipline, input.hari, input.slot_time, input.therapist_id,
  )
  if (collidingWith) {
    return { error: `Jam ini sudah dipakai ${collidingWith} — terapis yang akan menangani (mengikuti rotasi/pin) sama. Pilih jam lain, disiplin lain, atau pin ke terapis lain yang bertugas.` }
  }

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
    therapist_id: input.therapist_id ?? null,
    created_by: userId,
  }).select('id').single()

  if (error) {
    if (error.code === '23505') return { error: 'Anak ini sudah memiliki jadwal tetap di hari dan jam yang sama.' }
    return { error: error.message }
  }

  await logActivity({
    supabase, userId, action: 'create', resourceType: 'griya_slot',
    resourceId: data?.id, branchId: input.branch_id, patientId: input.patient_id,
    newValues: { hari: input.hari, slot_time: input.slot_time, discipline: input.discipline },
  })
  return { error: null, id: data?.id }
}

// ── Edit a MASTER slot's day/time/service, and optionally its therapist pin ─────

export interface UpdateMasterSlotInput {
  slotId: string
  hari: Hari
  slot_time: string
  discipline: Discipline
  service_type?: string | null
  package_id?: string | null
  /** Omit to leave the current pin untouched; pass null to clear it back to auto-rotation. */
  therapist_id?: string | null
}

export async function updateMasterSlot(input: UpdateMasterSlotInput): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots').select('branch_id, hari, slot_time, therapist_id').eq('id', input.slotId).single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const nextTherapistId = input.therapist_id !== undefined ? input.therapist_id : (slot.therapist_id as string | null)
  const collidingWith = await findSlotCollision(
    supabase, slot.branch_id as string, input.discipline, input.hari, input.slot_time,
    nextTherapistId, input.slotId,
  )
  if (collidingWith) {
    return { error: `Jam ini sudah dipakai ${collidingWith} — terapis yang akan menangani (mengikuti rotasi/pin) sama. Pilih jam lain, disiplin lain, atau pin ke terapis lain yang bertugas.` }
  }

  const { error } = await supabase
    .from('griya_schedule_slots')
    .update({
      hari: input.hari,
      slot_time: input.slot_time,
      discipline: input.discipline,
      service_type: input.service_type ?? null,
      package_id: input.package_id ?? null,
      ...(input.therapist_id !== undefined ? { therapist_id: input.therapist_id } : {}),
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

  const existing = await findVisitForSlotDate(supabase, input.slotId, input.date)

  if (await isCellOccupied(supabase, slot.branch_id as string, input.therapist_id, input.date, input.slot_time, {
    excludeSlotId: input.slotId, excludeVisitId: existing?.id,
  })) {
    return { error: 'Jam ini untuk terapis tersebut sudah terisi anak lain hari ini — pilih jam atau terapis lain.' }
  }

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

// ── Reassign an ad-hoc/substitute visit (no griya_schedule_slots row behind it)
// to a different therapist/time — same one-off semantics as moveSlot above, just
// keyed by visit id directly since there's no master slot to look up from. ─────

export interface MoveVisitInput {
  visitId: string
  therapist_id: string
  slot_time: string
}

export async function moveVisit(input: MoveVisitInput): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: visit } = await supabase
    .from('patient_visits').select('branch_id, visit_date').eq('id', input.visitId).single()
  if (!visit) return { error: 'Kunjungan tidak ditemukan' }

  if (await isCellOccupied(supabase, visit.branch_id as string, input.therapist_id, visit.visit_date as string, input.slot_time, {
    excludeVisitId: input.visitId,
  })) {
    return { error: 'Jam ini untuk terapis tersebut sudah terisi anak lain hari ini — pilih jam atau terapis lain.' }
  }

  const { error } = await supabase
    .from('patient_visits')
    .update({ attending_staff_id: input.therapist_id, visit_time: input.slot_time, updated_at: new Date().toISOString() })
    .eq('id', input.visitId)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'patient_visit', resourceId: input.visitId,
    branchId: visit.branch_id as string,
    newValues: { moved: true, therapist_id: input.therapist_id, slot_time: input.slot_time },
  })
  return { error: null }
}

type SlotRow = {
  branch_id: unknown; patient_id: unknown; discipline: unknown; hari: unknown
  service_type: unknown; slot_time: unknown; package_id: unknown; therapist_id: unknown
}

// Same inputs as the grid (incl. the slot's therapist pin and the admin-read
// branch schedule), so the child stays in the column it was shown in — resolving
// without the pin attributed a pinned slot to whoever rotation picked instead,
// and the card jumped columns the moment it was marked.
async function resolveSlotTherapist(
  supabase: SupaClient,
  slot: SlotRow,
): Promise<string | null> {
  const [{ data: therapists }, { data: schedules }] = await Promise.all([
    supabase.from('griya_therapists').select('therapist_id, discipline, display_order, is_active').eq('branch_id', slot.branch_id as string).eq('is_active', true),
    readBranchSchedules(supabase, slot.branch_id as string),
  ])
  return resolveTherapistForSlot(
    {
      discipline: slot.discipline as Discipline, hari: slot.hari as string,
      slot_time: hhmm(slot.slot_time as string) ?? '', therapist_id: (slot.therapist_id as string) ?? null,
    },
    (therapists ?? []) as { therapist_id: string; discipline: Discipline; display_order: number; is_active: boolean }[],
    ((schedules ?? []) as { staff_id: string; hari: string; jam_mulai: string; jam_selesai: string; status: string }[])
      .filter((r) => r.hari === slot.hari && r.status === 'AKTIF'),
  )
}

// ── Materialize a still-scheduled occurrence (no attendance) ─────────────────
// Lets a payment be recorded before the child is marked Hadir — the visit row is
// created as "scheduled" with kehadiran left empty.

export async function ensureSlotVisit(
  slotId: string,
  date: string,
): Promise<{ error: string | null; visit?: { id: string; patient_id: string; visit_date: string; service_type: string } }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase } = a

  const existing = await findVisitForSlotDate(supabase, slotId, date)
  if (existing) {
    const { data, error } = await supabase
      .from('patient_visits').select('id, patient_id, visit_date, service_type').eq('id', existing.id).single()
    if (error || !data) return { error: error?.message ?? 'Kunjungan tidak ditemukan' }
    return { error: null, visit: data as { id: string; patient_id: string; visit_date: string; service_type: string } }
  }

  const { data: slot } = await supabase
    .from('griya_schedule_slots')
    .select('branch_id, patient_id, discipline, hari, service_type, slot_time, package_id, therapist_id')
    .eq('id', slotId)
    .single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const orderId = await generateOrderId(supabase)
  const { data, error } = await supabase.from('patient_visits').insert({
    griya_slot_id: slotId,
    patient_id: slot.patient_id as string,
    branch_id: slot.branch_id as string,
    attending_staff_id: await resolveSlotTherapist(supabase, slot),
    visit_date: date,
    visit_time: hhmm(slot.slot_time as string),
    service_type: (slot.service_type as string) ?? 'SESI TERAPI',
    package_id: (slot.package_id as string) ?? null,
    order_id: orderId,
    status: 'scheduled',
    kehadiran: null,
    updated_at: new Date().toISOString(),
  }).select('id, patient_id, visit_date, service_type').single()
  if (error || !data) return { error: error?.message ?? 'Gagal membuat kunjungan' }
  return { error: null, visit: data as { id: string; patient_id: string; visit_date: string; service_type: string } }
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
    .select('branch_id, patient_id, discipline, hari, service_type, slot_time, package_id, therapist_id')
    .eq('id', slotId)
    .single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const existing = await findVisitForSlotDate(supabase, slotId, date)

  // Resolving who's actually on duty is only needed the first time this occurrence
  // is materialized (an existing row already has attending_staff_id set).
  const resolvedTherapistId = existing ? null : await resolveSlotTherapist(supabase, slot)

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

  const existing = await findVisitForSlotDate(supabase, slotId, date)
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

// ── Cancel a single day's occurrence of a recurring slot — quick "batalkan",
// distinct from marking an absence (no reason picker, always records 'cancelled') ─

export async function cancelOccurrence(slotId: string, date: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots')
    .select('branch_id, patient_id, discipline, hari, service_type, slot_time, package_id')
    .eq('id', slotId)
    .single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const existing = await findVisitForSlotDate(supabase, slotId, date)

  const patch = { kehadiran: 'TIDAK HADIR', status: 'cancelled', notes: 'Dibatalkan' }

  if (existing) {
    const { count: paidCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', existing.id)
      .eq('status', 'confirmed')
    if ((paidCount ?? 0) > 0) {
      return { error: 'Kunjungan ini sudah punya pembayaran terkonfirmasi — batalkan pembayarannya dulu sebelum membatalkan jadwal.' }
    }
    const { error } = await supabase
      .from('patient_visits')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const orderId = await generateOrderId(supabase)
    const { error } = await supabase.from('patient_visits').insert({
      griya_slot_id: slotId,
      patient_id: slot.patient_id as string,
      branch_id: slot.branch_id as string,
      attending_staff_id: null,
      visit_date: date,
      visit_time: hhmm(slot.slot_time as string),
      service_type: (slot.service_type as string) ?? 'SESI TERAPI',
      package_id: (slot.package_id as string) ?? null,
      order_id: orderId,
      updated_at: new Date().toISOString(),
      ...patch,
    })
    if (error) return { error: error.message }
  }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'griya_slot', resourceId: slotId,
    branchId: slot.branch_id as string,
    newValues: { date, status: 'cancelled' },
  })
  return { error: null }
}

// ── Mark / undo attendance for an ad-hoc (substitute) visit — no recurring
// griya_schedule_slots row behind it, so these are keyed by visit id directly ──

export async function markVisitAttendance(visitId: string, input: { present: boolean }): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: visit } = await supabase
    .from('patient_visits').select('branch_id').eq('id', visitId).single()
  if (!visit) return { error: 'Kunjungan tidak ditemukan' }

  const patch = input.present
    ? { kehadiran: 'HADIR', status: 'completed' }
    : { kehadiran: 'TIDAK HADIR', status: 'cancelled' }

  const { error } = await supabase
    .from('patient_visits')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', visitId)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'patient_visit', resourceId: visitId,
    branchId: visit.branch_id as string,
    newValues: { kehadiran: patch.kehadiran },
  })
  return { error: null }
}

export async function resetVisitAttendance(visitId: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: visit } = await supabase
    .from('patient_visits').select('branch_id').eq('id', visitId).single()
  if (!visit) return { error: 'Kunjungan tidak ditemukan' }

  const { count: paidCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId)
    .eq('status', 'confirmed')
  if ((paidCount ?? 0) > 0) {
    return { error: 'Kunjungan ini sudah punya pembayaran terkonfirmasi — batalkan pembayarannya dulu sebelum membatalkan kehadiran.' }
  }

  const { error } = await supabase
    .from('patient_visits')
    .update({ kehadiran: null, status: 'scheduled', updated_at: new Date().toISOString() })
    .eq('id', visitId)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'patient_visit', resourceId: visitId,
    branchId: visit.branch_id as string,
    newValues: { kehadiran: null, reset: true },
  })
  return { error: null }
}

// ── Detect whether a specific therapist+date+hour is already occupied by a real
// booking (not just a freed/moved-out ghost) — used to reject a substitute that
// would otherwise be inserted into the database but never render anywhere on the
// grid, which looked like the action silently doing nothing.
//
// This deliberately runs the grid's own resolveDay() over the same rows the grid
// loads, rather than re-implementing the rules: a hand-rolled copy here ignored
// each slot's start_date/end_date, so a schedule starting next week (or one
// already ended) still "occupied" cells the grid showed as Kosong — and every
// "Sekali saja (1 sesi)" booking into them was rejected. ──────────────────────

async function isCellOccupied(
  supabase: SupaClient, branchId: string, therapistId: string, dateIso: string, hour: string,
  opts?: { excludeSlotId?: string; excludeVisitId?: string },
): Promise<boolean> {
  const day = new Date(dateIso + 'T00:00:00')
  const weekMondayIso = addDaysIso(dateIso, -((day.getDay() + 6) % 7))
  const { therapistRows, slots, visits, schedules } = await loadGriyaWeekRows(
    supabase, branchId, weekMondayIso, { from: dateIso, to: dateIso },
  )
  const week: GriyaWeek = {
    branchId,
    therapists: therapistRows.map((t) => toGriyaTherapist(t, null)),
    slots: slots.map((s) => toGriyaSlot(s, '')),
    visits: visits.map((v) => toGriyaVisit(v, '', '')),
    schedules,
  }
  const { cells } = resolveDay(week, dateIso)
  return (cells.get(`${therapistId}|${hour}`) ?? []).some((c) =>
    isBusyCell(c)
    && !(opts?.excludeSlotId && c.slot?.id === opts.excludeSlotId)
    && !(opts?.excludeVisitId && c.visit?.id === opts.excludeVisitId),
  )
}

// ── Add a substitute into a freed cell for one week ──────────────────────────

export interface AddSubstituteInput {
  branch_id: string
  patient_id: string
  therapist_id: string
  date: string
  slot_time: string
  service_type?: string | null
  layanan_id?: string | null
  package_id?: string | null
  coveringName?: string | null
  /** 'once' = a standalone single session booked from "Sekali saja (1 sesi)" —
   *  same storage as a substitute (a patient_visits row with no griya_slot_id, so
   *  nothing recurs next week and deleting it removes it for good), just not
   *  labelled "Pengganti". */
  kind?: 'substitute' | 'once'
}

export async function addSubstitute(input: AddSubstituteInput): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  if (await isCellOccupied(supabase, input.branch_id, input.therapist_id, input.date, input.slot_time)) {
    return { error: 'Jam ini untuk terapis tersebut sudah terisi anak lain hari ini — pilih jam atau terapis lain.' }
  }

  await ensureEnrolled(a, input.patient_id, input.branch_id, 'jadwal')

  const orderId = await generateOrderId(supabase)
  const { error } = await supabase.from('patient_visits').insert({
    patient_id: input.patient_id,
    branch_id: input.branch_id,
    attending_staff_id: input.therapist_id,
    visit_date: input.date,
    visit_time: input.slot_time,
    service_type: input.service_type ?? 'SESI TERAPI',
    layanan_id: input.layanan_id ?? null,
    package_id: input.package_id ?? null,
    status: 'scheduled',
    griya_slot_id: null,
    notes: input.kind === 'once'
      ? null
      : input.coveringName ? `Pengganti untuk ${input.coveringName}` : 'Pengganti',
    order_id: orderId,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId, action: 'create', resourceType: 'griya_slot', resourceId: null,
    branchId: input.branch_id, patientId: input.patient_id,
    newValues: { [input.kind === 'once' ? 'one_off' : 'substitute']: true, date: input.date, therapist_id: input.therapist_id, slot_time: input.slot_time },
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

  // Anything already recorded after the end date must be dealt with first. A
  // session marked Hadir there stayed on the grid as history next to the slot
  // that replaced it — the same child counted twice for one real session.
  const { data: after } = await supabase
    .from('patient_visits').select('id, status, kehadiran')
    .eq('griya_slot_id', slotId).gt('visit_date', input.end_date)
  const afterRows = (after ?? []) as { id: string; status: string | null; kehadiran: string | null }[]
  if (afterRows.some(isRealisedVisit)) {
    return { error: 'Jadwal ini sudah punya sesi hadir setelah tanggal tersebut — ubah/hapus sesi itu dulu, atau pilih tanggal akhir yang lebih akhir.' }
  }
  // Untouched placeholders after the end date (e.g. a future move/cancel) would
  // otherwise linger as orphans of a schedule that no longer exists. Checked, not
  // fire-and-forget: a silently failed delete is how those orphans got left behind.
  const delErr = await deleteVisitsStrict(supabase, afterRows.map((v) => v.id))
  if (delErr) return { error: delErr }

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

// A visit is "realised" once it holds real data — attendance, a confirmed/pending
// payment, or clinical notes. Unrealised rows are just placeholders a move/cancel
// created for a date, and are safe to delete along with their slot.
function isRealisedVisit(v: { status: string | null; kehadiran: string | null }) {
  return v.kehadiran === 'HADIR' || v.status === 'completed'
}

function friendlyDeleteError(error: { code?: string; message: string }): string {
  if (error.code === '23503') {
    return 'Kunjungan ini sudah punya data terkait (pembayaran / catatan sesi / asesmen) — hapus data tersebut dulu, atau gunakan "Batalkan".'
  }
  return error.message
}

/** Deletes the given visits, verifying RLS actually let every row through — a
 *  policy-filtered DELETE returns no error, just zero rows, which used to look
 *  like success while the row silently stayed (and "came back" on reload). */
async function deleteVisitsStrict(supabase: SupaClient, ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null
  const { count: paidCount } = await supabase
    .from('transactions').select('id', { count: 'exact', head: true })
    .in('visit_id', ids).neq('status', 'rejected')
  if ((paidCount ?? 0) > 0) {
    return 'Kunjungan ini sudah punya pembayaran — batalkan/hapus pembayarannya dulu sebelum menghapus.'
  }
  const { data, error } = await supabase.from('patient_visits').delete().in('id', ids).select('id')
  if (error) return friendlyDeleteError(error)
  if ((data?.length ?? 0) !== ids.length) return 'Sebagian kunjungan tidak bisa dihapus (tidak memiliki akses ke data ini).'
  return null
}

/** Stops a recurring slot so nothing is generated after `lastDate`. A slot with no
 *  realised history left is deleted outright (e.g. one created by mistake);
 *  otherwise it's ended (status 'stopped') so its past sessions stay visible. */
async function stopSlotAfter(supabase: SupaClient, slotId: string, lastDate: string | null): Promise<string | null> {
  const { data: visits } = await supabase
    .from('patient_visits').select('id, visit_date, status, kehadiran').eq('griya_slot_id', slotId)
  const rows = (visits ?? []) as { id: string; visit_date: string; status: string | null; kehadiran: string | null }[]

  // Future placeholders (moves/cancellations already recorded after the stop date)
  // would otherwise linger as orphans — remove them; realised ones block.
  const after = lastDate ? rows.filter((v) => v.visit_date > lastDate) : rows
  if (after.some(isRealisedVisit)) {
    return 'Jadwal ini sudah punya sesi hadir setelah tanggal tersebut — ubah/hapus sesi itu dulu.'
  }
  const delErr = await deleteVisitsStrict(supabase, after.map((v) => v.id))
  if (delErr) return delErr

  const remaining = rows.length - after.length
  if (remaining === 0) {
    const { data, error } = await supabase.from('griya_schedule_slots').delete().eq('id', slotId).select('id')
    if (error) return error.message
    if (!data?.length) return 'Jadwal tidak bisa dihapus (tidak memiliki akses).'
    return null
  }

  const { data, error } = await supabase
    .from('griya_schedule_slots')
    .update({ status: 'stopped', end_date: lastDate })
    .eq('id', slotId).select('id')
  if (error) return error.message
  if (!data?.length) return 'Jadwal tidak bisa diubah (tidak memiliki akses).'
  return null
}

// ── Remove a master slot (Jadwal Master "Hapus") ─────────────────────────────
// Deletes it entirely when it has no realised sessions (placeholder rows from a
// move/cancel no longer block this); otherwise it must be ended instead so the
// attendance history is kept.

export async function removeSlot(slotId: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots').select('branch_id, patient_id, hari, slot_time').eq('id', slotId).single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const { data: visits } = await supabase
    .from('patient_visits').select('id, status, kehadiran').eq('griya_slot_id', slotId)
  if ((visits ?? []).some((v) => isRealisedVisit(v as { status: string | null; kehadiran: string | null }))) {
    return { error: 'Jadwal ini sudah punya riwayat kehadiran — gunakan "Akhiri Jadwal", jangan hapus.' }
  }

  const err = await stopSlotAfter(supabase, slotId, null)
  if (err) return { error: err }

  await logActivity({
    supabase, userId, action: 'delete', resourceType: 'griya_slot', resourceId: slotId,
    branchId: slot.branch_id as string, patientId: slot.patient_id as string,
    oldValues: { hari: slot.hari, slot_time: hhmm(slot.slot_time as string) },
  })
  return { error: null }
}

// ── Delete one date's occurrence of a recurring slot (grid "Hapus") ──────────
// Deleting only the patient_visits row of a slot-backed cell can't make the cell
// go away — the master slot regenerates a fresh "Terjadwal" occurrence for that
// date on the next reload. So the caller must choose explicitly:
//   stopRecurring=false → remove just this date's visit record (cell goes back to
//                         "Terjadwal" because the weekly schedule still exists)
//   stopRecurring=true  → also stop the weekly schedule from this date on, so the
//                         cell (and every later week) is truly empty.

export async function deleteOccurrence(
  slotId: string, date: string, opts: { stopRecurring: boolean },
): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: slot } = await supabase
    .from('griya_schedule_slots').select('branch_id, patient_id, start_date').eq('id', slotId).single()
  if (!slot) return { error: 'Slot tidak ditemukan' }

  const existing = await findVisitForSlotDate(supabase, slotId, date)
  if (!existing && !opts.stopRecurring) return { error: null } // nothing recorded for this date

  if (existing) {
    const err = await deleteVisitsStrict(supabase, [existing.id])
    if (err) return { error: err }
  }

  if (opts.stopRecurring) {
    const lastDate = addDaysIso(date, -1)
    const err = await stopSlotAfter(supabase, slotId, lastDate < (slot.start_date as string) ? null : lastDate)
    if (err) return { error: err }
  }

  await logActivity({
    supabase, userId, action: 'delete', resourceType: 'griya_slot', resourceId: slotId,
    branchId: slot.branch_id as string, patientId: slot.patient_id as string,
    oldValues: { date, stop_recurring: opts.stopRecurring },
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
