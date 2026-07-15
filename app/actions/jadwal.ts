'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import type { VisitStatus } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DailyVisit {
  id: string
  patient_id: string
  patient_name: string
  patient_phone: string
  branch_id: string
  visit_date: string
  visit_time: string | null    // HH:MM or null
  service_type: string | null
  package_id: string | null    // set → visit is part of a package, payment already covered
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  regio: string | null
  attending_staff_id: string | null
  status: VisitStatus
  notes: string | null
  // Payment info — populated by fetchDailyVisits
  has_payment: boolean
  visit_payment_status: string | null
}

export interface CreateVisitInput {
  patient_id: string
  branch_id: string
  attending_staff_id: string | null
  visit_date: string
  visit_time: string | null
  service_type?: string | null
  shift?: string | null
  chief_complaint: string | null
  status: VisitStatus
  notes: string | null
  package_id?: string | null
}

// ── Fetch all visits for a date with decrypted patient names ───────────────────
export async function fetchDailyVisits(date: string, branchId?: string | null): Promise<DailyVisit[]> {
  const supabase = await createClient()

  let query = supabase
    .from('patient_visits')
    .select('id, patient_id, attending_staff_id, visit_date, visit_time, service_type, package_id, chief_complaint, diagnosis, treatment, regio, status, notes, branch_id')
    .eq('visit_date', date)
    .order('visit_time', { ascending: true })
  if (branchId) query = query.eq('branch_id', branchId)
  const { data: visits, error } = await query

  if (error || !visits || visits.length === 0) return []

  // Batch-decrypt patient names
  const patientIds = [...new Set(visits.map((v) => v.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone')
    .in('id', patientIds)

  const nameMap = new Map<string, string>()
  const phoneMap = new Map<string, string>()
  for (const p of patients ?? []) {
    try {
      const dec = decryptPatientPII({
        encrypted_name:  p.encrypted_name  ?? '',
        encrypted_phone: p.encrypted_phone ?? '',
      })
      nameMap.set(p.id, dec.name || 'Pasien')
      phoneMap.set(p.id, dec.phone || '')
    } catch {
      nameMap.set(p.id, 'Pasien')
      phoneMap.set(p.id, '')
    }
  }

  // Batch-fetch payment status for all visits
  const visitIds = visits.map((v) => v.id)
  const { data: txns } = await supabase
    .from('transactions')
    .select('visit_id, payment_status, outstanding, status')
    .in('visit_id', visitIds)
    .neq('status', 'rejected')

  // Per-visit: last non-rejected transaction wins for display
  const payMap = new Map<string, { payment_status: string | null; all_paid: boolean }>()
  for (const t of txns ?? []) {
    const vid = t.visit_id as string
    const existing = payMap.get(vid)
    if (!existing) {
      payMap.set(vid, { payment_status: t.payment_status, all_paid: t.outstanding === 0 })
    } else {
      payMap.set(vid, {
        payment_status: t.payment_status ?? existing.payment_status,
        all_paid: existing.all_paid && t.outstanding === 0,
      })
    }
  }

  return visits.map((v) => {
    const pay = payMap.get(v.id)
    return {
      id:                   v.id,
      patient_id:           v.patient_id,
      patient_name:         nameMap.get(v.patient_id) ?? 'Pasien',
      patient_phone:        phoneMap.get(v.patient_id) ?? '',
      branch_id:            v.branch_id,
      visit_date:           v.visit_date,
      visit_time:           v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      service_type:         v.service_type,
      package_id:           v.package_id ?? null,
      chief_complaint:      v.chief_complaint,
      diagnosis:            v.diagnosis,
      treatment:            v.treatment,
      regio:                v.regio,
      attending_staff_id:   v.attending_staff_id,
      status:               v.status as VisitStatus,
      notes:                v.notes,
      has_payment:          !!pay,
      visit_payment_status: pay ? (pay.all_paid ? 'LUNAS' : pay.payment_status) : null,
    }
  })
}

// ── Create a new visit ─────────────────────────────────────────────────────────
export async function createVisit(input: CreateVisitInput): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('patient_visits').insert({
    patient_id:          input.patient_id,
    branch_id:           input.branch_id,
    attending_staff_id:  input.attending_staff_id ?? user?.id ?? null,
    visit_date:          input.visit_date,
    visit_time:          input.visit_time ?? null,
    service_type:        input.service_type ?? null,
    shift:               input.shift ?? null,
    chief_complaint:     input.chief_complaint ?? null,
    status:              input.status,
    notes:               input.notes ?? null,
    package_id:          input.package_id ?? null,
    updated_at:          new Date().toISOString(),
  })

  return { error: error?.message ?? null }
}

// ── Quick status update ────────────────────────────────────────────────────────
export async function updateVisitStatus(
  visitId: string,
  status: VisitStatus,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('patient_visits')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', visitId)
  return { error: error?.message ?? null }
}

// ── Delete visit ───────────────────────────────────────────────────────────────
export async function deleteVisit(visitId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.from('patient_visits').delete().eq('id', visitId)
  return { error: error?.message ?? null }
}

// ── Fetch a single visit with decrypted patient name ──────────────────────────
export interface VisitWithPatient {
  id: string
  patient_id: string
  patient_name: string
  branch_id: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  shift: string | null
  kehadiran: string | null
  regio: string | null
  sumber_pasien: string | null
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  attending_staff_id: string | null
  status: VisitStatus
  notes: string | null
}

export async function fetchVisitWithPatient(visitId: string): Promise<VisitWithPatient | null> {
  const supabase = await createClient()
  const { data: v, error } = await supabase
    .from('patient_visits')
    .select('id, patient_id, branch_id, visit_date, visit_time, service_type, shift, kehadiran, regio, sumber_pasien, chief_complaint, diagnosis, treatment, attending_staff_id, status, notes')
    .eq('id', visitId)
    .single()

  if (error || !v) return null

  const { data: p } = await supabase
    .from('patients')
    .select('encrypted_name, encrypted_phone')
    .eq('id', v.patient_id)
    .single()

  let patient_name = 'Pasien'
  if (p) {
    try {
      const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
      patient_name = dec.name || 'Pasien'
    } catch { /* keep default */ }
  }

  return {
    id:                 v.id,
    patient_id:         v.patient_id,
    patient_name,
    branch_id:          v.branch_id,
    visit_date:         v.visit_date,
    visit_time:         v.visit_time ? String(v.visit_time).slice(0, 5) : null,
    service_type:       v.service_type,
    shift:              v.shift,
    kehadiran:          v.kehadiran,
    regio:              v.regio,
    sumber_pasien:      v.sumber_pasien,
    chief_complaint:    v.chief_complaint,
    diagnosis:          v.diagnosis,
    treatment:          v.treatment,
    attending_staff_id: v.attending_staff_id,
    status:             v.status as VisitStatus,
    notes:              v.notes,
  }
}

// ── Update visit clinical fields ───────────────────────────────────────────────
export async function updateVisit(
  visitId: string,
  data: {
    service_type?: string | null
    shift?: string | null
    kehadiran?: string | null
    regio?: string | null
    sumber_pasien?: string | null
    chief_complaint?: string | null
    diagnosis?: string | null
    treatment?: string | null
    status?: VisitStatus
    notes?: string | null
  },
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('patient_visits')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', visitId)
  return { error: error?.message ?? null }
}

// ── Fetch active staff for a branch (therapist dropdown) ──────────────────────
export interface BranchStaffMember {
  id: string
  full_name: string
  nickname: string | null
}

export async function fetchBranchStaff(branchId: string): Promise<BranchStaffMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_profiles')
    .select('id, full_name, nickname')
    .eq('branch_id', branchId)
    .in('role', ['therapist', 'staff', 'manager'])
    .eq('is_active', true)
    .order('full_name')
  return (data ?? []) as BranchStaffMember[]
}

// ── Mark visit as no-show and optionally create a rescheduled visit ────────────
export interface RescheduleInput {
  visit_date: string
  visit_time: string | null
  attending_staff_id: string | null
  notes: string | null
  shift: string | null
}

export async function markNoShowAndReschedule(
  visitId: string,
  reschedule?: RescheduleInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error: noShowErr } = await supabase
    .from('patient_visits')
    .update({ status: 'no_show', kehadiran: 'TIDAK HADIR', updated_at: new Date().toISOString() })
    .eq('id', visitId)
  if (noShowErr) return { error: noShowErr.message }

  if (!reschedule) return { error: null }

  const { data: original, error: fetchErr } = await supabase
    .from('patient_visits')
    .select('patient_id, branch_id, chief_complaint')
    .eq('id', visitId)
    .single()
  if (fetchErr || !original) return { error: fetchErr?.message ?? 'Kunjungan asal tidak ditemukan' }

  const { error: createErr } = await supabase.from('patient_visits').insert({
    patient_id:         original.patient_id,
    branch_id:          original.branch_id,
    attending_staff_id: reschedule.attending_staff_id,
    visit_date:         reschedule.visit_date,
    visit_time:         reschedule.visit_time ?? null,
    chief_complaint:    original.chief_complaint ?? null,
    status:             'scheduled',
    notes:              reschedule.notes ?? null,
    shift:              reschedule.shift ?? null,
    updated_at:         new Date().toISOString(),
  })
  return { error: createErr?.message ?? null }
}

// ── Bulk-create visits (recurring assignment) ──────────────────────────────────
export async function createBulkVisits(
  inputs: CreateVisitInput[],
): Promise<{ error: string | null; created: number }> {
  if (inputs.length === 0) return { error: null, created: 0 }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rows = inputs.map((input) => ({
    patient_id:          input.patient_id,
    branch_id:           input.branch_id,
    attending_staff_id:  input.attending_staff_id ?? user?.id ?? null,
    visit_date:          input.visit_date,
    visit_time:          input.visit_time ?? null,
    service_type:        input.service_type ?? null,
    shift:               input.shift ?? null,
    chief_complaint:     input.chief_complaint ?? null,
    status:              input.status,
    notes:               input.notes ?? null,
    package_id:          input.package_id ?? null,
    updated_at:          new Date().toISOString(),
  }))

  const { data, error } = await supabase.from('patient_visits').insert(rows).select('id')
  return { error: error?.message ?? null, created: data?.length ?? 0 }
}

// ── Send medical record reminder to a therapist ───────────────────────────────
const REMIND_ROLES = ['admin', 'director', 'manager']

export async function sendMedicalRecordReminder(
  visitId: string,
): Promise<{ error: string | null; alreadySent?: boolean }> {
  const supabase = await createClient()
  const admin    = createAdminClient()

  // Auth: only REMIND_ROLES can send reminders
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !REMIND_ROLES.includes(profile.role)) return { error: 'Forbidden' }

  // Fetch the visit
  const { data: visit, error: visitErr } = await supabase
    .from('patient_visits')
    .select('id, status, diagnosis, treatment, regio, attending_staff_id, visit_date')
    .eq('id', visitId)
    .single()
  if (visitErr || !visit) return { error: 'Kunjungan tidak ditemukan' }
  if (visit.status !== 'completed') return { error: 'Kunjungan belum selesai' }
  if (visit.diagnosis && visit.treatment && visit.regio) return { error: 'Rekam medis sudah lengkap' }
  if (!visit.attending_staff_id) return { error: 'Tidak ada terapis yang ditugaskan' }

  // Cooldown: skip if a reminder was already sent today for this visit
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: existing } = await admin
    .from('user_notifications')
    .select('id')
    .eq('user_id', visit.attending_staff_id)
    .eq('title', 'Rekam Medis Belum Diisi')
    .like('message', `%${visit.id}%`)
    .gte('created_at', todayStart.toISOString())
    .limit(1)
  if (existing && existing.length > 0) return { error: null, alreadySent: true }

  // Build message
  const dateStr = new Date(visit.visit_date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const missing: string[] = []
  if (!visit.diagnosis) missing.push('diagnosis')
  if (!visit.treatment) missing.push('tindakan')
  if (!visit.regio)     missing.push('regio')

  await admin.from('user_notifications').insert({
    user_id: visit.attending_staff_id,
    title:   'Rekam Medis Belum Diisi',
    message: `[${visit.id}] Kunjungan ${dateStr} perlu dilengkapi: ${missing.join(', ')}`,
    link:    '/jadwal-harian',
  })

  return { error: null }
}

// ── Send reminders for multiple incomplete visits ─────────────────────────────
export async function sendBulkMedicalRecordReminders(
  visitIds: string[],
): Promise<{ sent: number; skipped: number; error: string | null }> {
  let sent = 0
  let skipped = 0
  for (const id of visitIds) {
    const result = await sendMedicalRecordReminder(id)
    if (result.error) return { sent, skipped, error: result.error }
    if (result.alreadySent) skipped++
    else sent++
  }
  return { sent, skipped, error: null }
}
