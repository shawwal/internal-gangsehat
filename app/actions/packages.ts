'use server'

import { createClient } from '@/lib/supabase/server'
import type { PatientPackage, PackageSession } from '@/types'

// ── Fetch all packages for a patient with computed session counts ───────────────
// Reads from the patient_packages_with_stats view which joins patient_visits.
export async function fetchPatientPackages(
  patientId: string,
): Promise<PatientPackage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_packages_with_stats')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error || !data?.length) return []

  return data.map((p) => ({
    id:                 p.id,
    patient_id:         p.patient_id,
    branch_id:          p.branch_id ?? null,
    package_name:       p.package_name,
    package_type:       p.package_type as PatientPackage['package_type'],
    total_sessions:     p.total_sessions,
    used_sessions:      Number(p.used_sessions ?? 0),
    remaining_sessions: Number(p.remaining_sessions ?? p.total_sessions),
    notes:              p.notes ?? null,
    status:             p.status as PatientPackage['status'],
    jenis_paket:        (p.jenis_paket ?? null) as PatientPackage['jenis_paket'],
    mulai_paket:        (p.mulai_paket ?? null) as PatientPackage['mulai_paket'],
    operational_status: (p.operational_status ?? 'ON') as PatientPackage['operational_status'],
    completion_status:  (p.completion_status ?? null) as PatientPackage['completion_status'],
    created_at:         p.created_at,
    updated_at:         p.updated_at,
  }))
}

// ── Fetch all visits linked to a specific package ──────────────────────────────
export async function fetchPackageSessions(
  packageId: string,
): Promise<PackageSession[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_visits')
    .select('id, visit_date, service_type, shift, kehadiran, status, internal_profiles!attending_staff_id(full_name)')
    .eq('package_id', packageId)
    .neq('status', 'cancelled')
    .order('visit_date', { ascending: true })

  if (error || !data?.length) return []

  return data.map((v) => ({
    id:             v.id,
    visit_date:     v.visit_date,
    service_type:   v.service_type,
    shift:          v.shift as PackageSession['shift'],
    kehadiran:      v.kehadiran as PackageSession['kehadiran'],
    status:         v.status,
    therapist_name: (v.internal_profiles as { full_name: string } | null)?.full_name ?? null,
  }))
}

// ── Create a new patient package ───────────────────────────────────────────────
// total_sessions is derived from jenis_paket (P1→5, P2→10) when provided.
export async function createPatientPackage(input: {
  patient_id: string
  branch_id: string | null
  package_name: string
  jenis_paket: 'P1' | 'P2'
  mulai_paket: 'NEW' | 'EXT.'
  notes?: string | null
}): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const total_sessions = input.jenis_paket === 'P1' ? 5 : 10

  const { data, error } = await supabase
    .from('patient_packages')
    .insert({
      patient_id:     input.patient_id,
      branch_id:      input.branch_id,
      package_name:   input.package_name,
      package_type:   'fixed',
      total_sessions,
      jenis_paket:    input.jenis_paket,
      mulai_paket:    input.mulai_paket,
      notes:          input.notes ?? null,
      created_by:     user?.id ?? null,
      updated_at:     new Date().toISOString(),
    })
    .select('id')
    .single()

  return { id: data?.id ?? null, error: error?.message ?? null }
}

// ── Update an existing package ─────────────────────────────────────────────────
export async function updatePatientPackage(
  id: string,
  patch: {
    package_name?: string
    jenis_paket?: 'P1' | 'P2'
    mulai_paket?: 'NEW' | 'EXT.'
    operational_status?: 'ON' | 'OFF' | 'PENDING'
    completion_status?: 'LANJUT' | 'SEMBUH' | 'TIDAK LANJUT' | 'STOP' | null
    status?: 'active' | 'completed' | 'cancelled'
    notes?: string | null
  },
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }

  // Sync total_sessions when jenis_paket changes
  if (patch.jenis_paket) {
    update.total_sessions = patch.jenis_paket === 'P1' ? 5 : 10
  }

  const { error } = await supabase
    .from('patient_packages')
    .update(update)
    .eq('id', id)

  return { error: error?.message ?? null }
}

// ── Soft-delete (cancel) a package ────────────────────────────────────────────
export async function deletePatientPackage(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('patient_packages')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)

  return { error: error?.message ?? null }
}
