import type { SupabaseClient } from '@supabase/supabase-js'

type VisitRef = {
  id: string
  griya_slot_id?: string | null
  attending_staff_id?: string | null
  branch_id?: string | null
}

// Resolves each Griya Anak visit's discipline: the schedule slot's discipline
// when the visit came from the jadwal, otherwise the attending therapist's
// griya_therapists column (substitutes / visits created outside the jadwal).
// Server-side only — pass the request's Supabase client.
export async function fetchVisitDisciplines(
  supabase: SupabaseClient,
  visits: VisitRef[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (visits.length === 0) return out

  const slotIds = [...new Set(visits.map((v) => v.griya_slot_id).filter((x): x is string => !!x))]
  const staffIds = [...new Set(visits.map((v) => v.attending_staff_id).filter((x): x is string => !!x))]

  const [slots, therapists] = await Promise.all([
    slotIds.length
      ? supabase.from('griya_schedule_slots').select('id, discipline').in('id', slotIds)
      : Promise.resolve({ data: [] as { id: string; discipline: string }[] }),
    staffIds.length
      ? supabase.from('griya_therapists').select('therapist_id, branch_id, discipline').in('therapist_id', staffIds)
      : Promise.resolve({ data: [] as { therapist_id: string; branch_id: string; discipline: string }[] }),
  ])

  const slotMap = new Map((slots.data ?? []).map((s) => [s.id as string, s.discipline as string]))
  const therapistRows = (therapists.data ?? []) as { therapist_id: string; branch_id: string; discipline: string }[]

  for (const v of visits) {
    const fromSlot = v.griya_slot_id ? slotMap.get(v.griya_slot_id) : undefined
    if (fromSlot) { out.set(v.id, fromSlot); continue }
    const t = v.attending_staff_id
      ? therapistRows.find((r) => r.therapist_id === v.attending_staff_id && (!v.branch_id || r.branch_id === v.branch_id))
        ?? therapistRows.find((r) => r.therapist_id === v.attending_staff_id)
      : undefined
    out.set(v.id, t?.discipline ?? null)
  }
  return out
}
