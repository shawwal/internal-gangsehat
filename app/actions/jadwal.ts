'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import type { VisitStatus } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DailyVisit {
  id: string
  patient_id: string
  patient_name: string
  branch_id: string
  visit_date: string
  visit_time: string | null    // HH:MM or null
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  attending_staff_id: string | null
  status: VisitStatus
  notes: string | null
}

export interface CreateVisitInput {
  patient_id: string
  branch_id: string
  attending_staff_id: string | null
  visit_date: string
  visit_time: string | null
  chief_complaint: string | null
  status: VisitStatus
  notes: string | null
}

// ── Fetch all visits for a date with decrypted patient names ───────────────────
export async function fetchDailyVisits(date: string): Promise<DailyVisit[]> {
  const supabase = await createClient()

  const { data: visits, error } = await supabase
    .from('patient_visits')
    .select('id, patient_id, attending_staff_id, visit_date, visit_time, chief_complaint, diagnosis, treatment, status, notes, branch_id')
    .eq('visit_date', date)
    .order('visit_time', { ascending: true })

  if (error || !visits || visits.length === 0) return []

  // Batch-decrypt patient names
  const patientIds = [...new Set(visits.map((v) => v.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone')
    .in('id', patientIds)

  const nameMap = new Map<string, string>()
  for (const p of patients ?? []) {
    try {
      const dec = decryptPatientPII({
        encrypted_name:  p.encrypted_name  ?? '',
        encrypted_phone: p.encrypted_phone ?? '',
      })
      nameMap.set(p.id, dec.name || 'Pasien')
    } catch {
      nameMap.set(p.id, 'Pasien')
    }
  }

  return visits.map((v) => ({
    id:                 v.id,
    patient_id:         v.patient_id,
    patient_name:       nameMap.get(v.patient_id) ?? 'Pasien',
    branch_id:          v.branch_id,
    visit_date:         v.visit_date,
    visit_time:         v.visit_time ? String(v.visit_time).slice(0, 5) : null,
    chief_complaint:    v.chief_complaint,
    diagnosis:          v.diagnosis,
    treatment:          v.treatment,
    attending_staff_id: v.attending_staff_id,
    status:             v.status as VisitStatus,
    notes:              v.notes,
  }))
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
    chief_complaint:     input.chief_complaint ?? null,
    status:              input.status,
    notes:               input.notes ?? null,
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
