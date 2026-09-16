'use server'

import { createClient } from '@/lib/supabase/server'
import type { GriyaSessionNote, VisitStatus } from '@/types'

export type GriyaSessionNoteFieldsInput = Partial<Omit<GriyaSessionNote,
  'id' | 'visit_id' | 'patient_id' | 'branch_id' | 'status' | 'created_by' | 'created_at' | 'updated_at'
>>

// ── Fetch the note for a visit (supports re-opening/editing after completion) ──
export async function fetchGriyaSessionNote(visitId: string): Promise<GriyaSessionNote | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('griya_session_notes')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (error || !data) return null
  return data as GriyaSessionNote
}

// ── "Pertemuan Ke-N": this visit's rank among visits sharing the same recurring
// slot (or, for ad-hoc/no-slot visits, among the patient's own visits), ordered
// by date — derived, not stored, same approach as package session numbering.
export async function fetchGriyaPertemuanKe(visitId: string, patientId: string, griyaSlotId: string | null): Promise<number> {
  const supabase = await createClient()

  const query = griyaSlotId
    ? supabase.from('patient_visits').select('id, visit_date, visit_time').eq('griya_slot_id', griyaSlotId).neq('status', 'cancelled')
    : supabase.from('patient_visits').select('id, visit_date, visit_time').eq('patient_id', patientId).is('griya_slot_id', null).neq('status', 'cancelled')

  const { data: visits } = await query
  const sorted = [...(visits ?? [])].sort((a, b) => {
    const da = `${a.visit_date} ${a.visit_time ?? '00:00'}`
    const db = `${b.visit_date} ${b.visit_time ?? '00:00'}`
    return da.localeCompare(db)
  })
  const idx = sorted.findIndex((v) => v.id === visitId)
  return idx >= 0 ? idx + 1 : 1
}

// Therapists/staff can't resubmit a note that's already completed — keeps the
// record from being silently rewritten after the fact. Admin/manager/director
// retain the ability to correct a mistake.
const LOCKED_FOR_ROLES = ['therapist', 'staff']

// ── Single-shot save (matches the "Sudah diperiksa" + Update modal) ─────────────
export async function saveGriyaSessionNote(
  visitId: string,
  patientId: string,
  branchId: string,
  fields: GriyaSessionNoteFieldsInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase.from('internal_profiles').select('role').eq('id', user.id).single(),
    supabase.from('griya_session_notes').select('status').eq('visit_id', visitId).maybeSingle(),
  ])
  if (existing?.status === 'completed' && LOCKED_FOR_ROLES.includes(profile?.role ?? '')) {
    return { error: 'Rekam medis sudah dikunci setelah disimpan. Hubungi admin/manajer untuk perubahan.' }
  }

  const status = fields.sudah_diperiksa ? 'completed' : 'draft'

  const { error: noteErr } = await supabase
    .from('griya_session_notes')
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

  if (noteErr) return { error: noteErr.message }

  if (fields.sudah_diperiksa) {
    const { error: visitErr } = await supabase
      .from('patient_visits')
      .update({
        status: 'completed' satisfies VisitStatus,
        kehadiran: 'HADIR',
        updated_at: new Date().toISOString(),
      })
      .eq('id', visitId)
    if (visitErr) return { error: visitErr.message }
  }

  return { error: null }
}
