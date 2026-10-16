// "Who should this transaction / visit be credited to?" — the last therapist
// who handled the patient: their latest attended visit in the same branch, on
// or before the given date. Only a suggestion: nothing is counted until it is
// written to `transactions.fisio_id` / `patient_visits.attending_staff_id`.

import { createAdminClient } from '@/lib/supabase/admin'
import { KUNJUNGAN_VISIT_STATUSES, visitAttended } from '@/lib/metrics/achievement'

export interface SuggestItem {
  key: string
  patient_id: string | null
  branch_id: string
  /** YYYY-MM-DD — transaction date / visit date */
  date: string
  /** a visit being checked never suggests itself */
  excludeVisitId?: string
}

export interface VisitForSuggest {
  id: string
  patient_id: string
  branch_id: string
  visit_date: string
  attending_staff_id: string | null
  status: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
}

export interface TherapistSuggestion {
  staffId: string
  name: string
  /** date of the visit the suggestion comes from */
  visitDate: string
}

/** Pure: the latest attended, staffed visit of the item's patient + branch dated ≤ item.date. */
export function pickLastTherapistVisit(visits: VisitForSuggest[], item: SuggestItem, todayISO: string): VisitForSuggest | null {
  let best: VisitForSuggest | null = null
  for (const v of visits) {
    if (v.patient_id !== item.patient_id || v.branch_id !== item.branch_id) continue
    if (!v.attending_staff_id || v.id === item.excludeVisitId) continue
    if (v.status != null && !(KUNJUNGAN_VISIT_STATUSES as readonly string[]).includes(v.status)) continue
    if (v.visit_date > item.date || !visitAttended(v, todayISO)) continue
    if (!best || v.visit_date > best.visit_date) best = v
  }
  return best
}

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/**
 * Suggestion per item key. Reads with the service role — callers must have
 * checked the caller's role / branch already (only staff ids, dates and names
 * come back, no patient data).
 */
export async function suggestLastTherapists(items: SuggestItem[]): Promise<Map<string, TherapistSuggestion>> {
  const out = new Map<string, TherapistSuggestion>()
  const patientIds = [...new Set(items.map((i) => i.patient_id).filter((x): x is string => !!x))]
  if (!patientIds.length) return out
  const admin = createAdminClient()
  const maxDate = items.reduce((m, i) => (i.date > m ? i.date : m), '')

  const visits: VisitForSuggest[] = []
  for (let i = 0; i < patientIds.length; i += 300) {
    const { data } = await admin
      .from('patient_visits')
      .select('id, patient_id, branch_id, visit_date, attending_staff_id, status, kehadiran')
      .in('patient_id', patientIds.slice(i, i + 300))
      .not('attending_staff_id', 'is', null)
      .lte('visit_date', maxDate)
      .limit(20000)
    visits.push(...((data ?? []) as VisitForSuggest[]))
  }

  const today = todayJakarta()
  const picked = new Map<string, VisitForSuggest>()
  for (const item of items) {
    const v = pickLastTherapistVisit(visits, item, today)
    if (v) picked.set(item.key, v)
  }
  const staffIds = [...new Set([...picked.values()].map((v) => v.attending_staff_id as string))]
  if (!staffIds.length) return out
  const { data: profiles } = await admin.from('internal_profiles').select('id, full_name, nickname').in('id', staffIds)
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, (p.nickname?.trim() || p.full_name) as string]))

  for (const [key, v] of picked) {
    out.set(key, { staffId: v.attending_staff_id as string, name: nameById.get(v.attending_staff_id as string) ?? '—', visitDate: v.visit_date })
  }
  return out
}
