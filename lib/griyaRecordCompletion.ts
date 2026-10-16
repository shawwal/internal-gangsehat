import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchVisitDisciplines } from '@/lib/griyaDiscipline'
import { getGriyaVisitFormRoute, type GriyaVisitFormRoute } from '@/lib/griyaVisitRouting'

// Griya Anak branches keep their own rekam medis — griya_terapi_awal (intake)
// and griya_session_notes (sesi) — instead of patient_visits.diagnosis /
// treatment / regio. A Griya visit is "lengkap" once the form its route points
// at is marked completed; visits with no Griya form (route null, e.g. LAINNYA)
// have nothing to fill and are left out of completeness counts.
// Server-side only — pass the request's Supabase client.

/** Embed for a patient_visits select (visit_id is UNIQUE → one row or null). */
export const GRIYA_RECORD_EMBED = 'griya_terapi_awal(status), griya_session_notes(status)'

type Embedded = { status: string | null } | { status: string | null }[] | null | undefined

export interface GriyaRecordVisit {
  id: string
  service_type: string | null
  griya_slot_id?: string | null
  attending_staff_id?: string | null
  branch_id?: string | null
  griya_terapi_awal?: Embedded
  griya_session_notes?: Embedded
}

export interface GriyaRecordState {
  route: GriyaVisitFormRoute | null
  status: 'completed' | 'draft' | null
  /** null = no Griya form for this visit (not counted). */
  complete: boolean | null
}

function embeddedStatus(e: Embedded): 'completed' | 'draft' | null {
  const row = Array.isArray(e) ? e[0] : e
  return (row?.status ?? null) as 'completed' | 'draft' | null
}

export async function fetchGriyaBranchIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('branch_griya_settings').select('branch_id').eq('enabled', true)
  return (data ?? []).map((b) => b.branch_id as string)
}

export async function resolveGriyaRecordStates(
  supabase: SupabaseClient,
  visits: GriyaRecordVisit[],
): Promise<Map<string, GriyaRecordState>> {
  const out = new Map<string, GriyaRecordState>()
  if (visits.length === 0) return out
  const disciplines = await fetchVisitDisciplines(supabase, visits)
  for (const v of visits) {
    const route = getGriyaVisitFormRoute(v.service_type, disciplines.get(v.id))
    const status = route === 'terapi-awal'
      ? embeddedStatus(v.griya_terapi_awal)
      : route === 'session-note' ? embeddedStatus(v.griya_session_notes) : null
    out.set(v.id, { route, status, complete: route ? status === 'completed' : null })
  }
  return out
}
