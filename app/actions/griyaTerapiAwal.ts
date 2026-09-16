'use server'

import { createClient } from '@/lib/supabase/server'
import type { GriyaTerapiAwal, VisitStatus } from '@/types'

export type GriyaTerapiAwalFieldsInput = Partial<Omit<GriyaTerapiAwal,
  'id' | 'visit_id' | 'patient_id' | 'branch_id' | 'status' | 'created_by' | 'created_at' | 'updated_at'
>>

// ── Fetch the intake draft/completed row for a visit (may not exist yet) ──────
export async function fetchGriyaTerapiAwal(visitId: string): Promise<GriyaTerapiAwal | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('griya_terapi_awal')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (error || !data) return null
  return data as GriyaTerapiAwal
}

// ── Save the full current form state as a draft ────────────────────────────────
export async function saveGriyaTerapiAwalDraft(
  visitId: string,
  patientId: string,
  branchId: string,
  fields: GriyaTerapiAwalFieldsInput,
): Promise<{ error: string | null; intake?: GriyaTerapiAwal }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: existing } = await supabase
    .from('griya_terapi_awal')
    .select('status')
    .eq('visit_id', visitId)
    .maybeSingle()

  // Never downgrade an already-completed intake back to draft.
  const status = existing?.status === 'completed' ? 'completed' : 'draft'

  const { data, error } = await supabase
    .from('griya_terapi_awal')
    .upsert(
      {
        visit_id: visitId,
        patient_id: patientId,
        branch_id: branchId,
        created_by: user?.id ?? null,
        status,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'visit_id' },
    )
    .select()
    .single()

  if (error) return { error: error.message }
  return { error: null, intake: data as GriyaTerapiAwal }
}

// Therapists/staff can't resubmit an intake that's already completed — keeps the
// record from being silently rewritten after the fact. Admin/manager/director
// retain the ability to correct a mistake.
const LOCKED_FOR_ROLES = ['therapist', 'staff']

// ── Complete the intake and mark the visit completed ────────────────────────────
export async function completeGriyaTerapiAwal(
  visitId: string,
  patientId: string,
  branchId: string,
  fields: GriyaTerapiAwalFieldsInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase.from('internal_profiles').select('role').eq('id', user.id).single(),
    supabase.from('griya_terapi_awal').select('status').eq('visit_id', visitId).maybeSingle(),
  ])
  if (existing?.status === 'completed' && LOCKED_FOR_ROLES.includes(profile?.role ?? '')) {
    return { error: 'Terapi Awal sudah dikunci setelah disimpan. Hubungi admin/manajer untuk perubahan.' }
  }

  const { error: intakeErr } = await supabase
    .from('griya_terapi_awal')
    .upsert(
      {
        visit_id: visitId,
        patient_id: patientId,
        branch_id: branchId,
        created_by: user?.id ?? null,
        status: 'completed',
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'visit_id' },
    )

  if (intakeErr) return { error: intakeErr.message }

  const { error: visitErr } = await supabase
    .from('patient_visits')
    .update({
      status: 'completed' satisfies VisitStatus,
      kehadiran: 'HADIR',
      diagnosis: fields.diagnosa || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)

  return { error: visitErr?.message ?? null }
}
