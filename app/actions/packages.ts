'use server'

import { createClient } from '@/lib/supabase/server'
import type { PatientPackage } from '@/types'

// ── Fetch all packages for a patient with computed used_sessions ───────────────
export async function fetchPatientPackages(
  patientId: string,
): Promise<PatientPackage[]> {
  const supabase = await createClient()

  const { data: packages, error } = await supabase
    .from('patient_packages')
    .select('id, package_name, package_type, total_sessions, notes, status')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error || !packages?.length) return []

  // Count used sessions (non-cancelled visits linked to each package)
  const packageIds = packages.map((p) => p.id)
  const { data: visitRows } = await supabase
    .from('patient_visits')
    .select('package_id')
    .in('package_id', packageIds)
    .neq('status', 'cancelled')

  const countMap = new Map<string, number>()
  for (const v of visitRows ?? []) {
    if (v.package_id) {
      countMap.set(v.package_id, (countMap.get(v.package_id) ?? 0) + 1)
    }
  }

  return packages.map((p) => ({
    id:                 p.id,
    package_name:       p.package_name,
    package_type:       p.package_type as PatientPackage['package_type'],
    total_sessions:     p.total_sessions,
    used_sessions:      countMap.get(p.id) ?? 0,
    notes:              p.notes ?? null,
    status:             p.status as PatientPackage['status'],
    // Operational fields (migration 023) — not selected here, default to null/ON
    jenis_paket:        null,
    mulai_paket:        null,
    operational_status: 'ON' as const,
    completion_status:  null,
    t1: null, t2: null, t3: null, t4: null, t5: null,
    t6: null, t7: null, t8: null, t9: null, t10: null,
  }))
}

// ── Create a new patient package ───────────────────────────────────────────────
export async function createPatientPackage(input: {
  patient_id: string
  branch_id: string
  package_name: string
  package_type: 'fixed' | 'flexible'
  total_sessions: number
  notes?: string | null
}): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('patient_packages')
    .insert({
      patient_id:     input.patient_id,
      branch_id:      input.branch_id,
      package_name:   input.package_name,
      package_type:   input.package_type,
      total_sessions: input.total_sessions,
      notes:          input.notes ?? null,
      created_by:     user?.id ?? null,
      updated_at:     new Date().toISOString(),
    })
    .select('id')
    .single()

  return { id: data?.id ?? null, error: error?.message ?? null }
}
