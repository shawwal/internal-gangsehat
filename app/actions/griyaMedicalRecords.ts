'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import type { GriyaSessionNote, GriyaTerapiAwal } from '@/types'

export interface GriyaRecordEntry {
  visitId: string
  visitDate: string
  visitTime: string | null
  serviceType: string | null
  kind: 'terapi-awal' | 'session-note'
  therapistName: string | null
  griyaSlotId: string | null
  pertemuanKe: number | null
  attended: boolean
  terapiAwal: GriyaTerapiAwal | null
  note: GriyaSessionNote | null
}

export interface GriyaMedicalRecords {
  branchId: string | null
  entries: GriyaRecordEntry[]   // newest first
}

export async function fetchGriyaMedicalRecords(patientId: string): Promise<GriyaMedicalRecords> {
  const supabase = await createClient()
  const { data: visits } = await supabase
    .from('patient_visits')
    .select('id, branch_id, visit_date, visit_time, service_type, status, kehadiran, attending_staff_id, griya_slot_id')
    .eq('patient_id', patientId)
    .neq('status', 'cancelled')
    .order('visit_date', { ascending: true })
    .order('visit_time', { ascending: true })

  const rec = (visits ?? []).filter((v) => getGriyaVisitFormRoute(v.service_type))
  if (rec.length === 0) return { branchId: visits?.[0]?.branch_id ?? null, entries: [] }

  const ids = rec.map((v) => v.id as string)
  const [notes, intakes] = await Promise.all([
    supabase.from('griya_session_notes').select('*').in('visit_id', ids),
    supabase.from('griya_terapi_awal').select('*').in('visit_id', ids),
  ])
  const noteMap = new Map((notes.data ?? []).map((n) => [n.visit_id as string, n as GriyaSessionNote]))
  const intakeMap = new Map((intakes.data ?? []).map((n) => [n.visit_id as string, n as GriyaTerapiAwal]))

  const staffIds = [...new Set(rec.map((v) => v.attending_staff_id as string | null).filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (staffIds.length > 0) {
    const { data: profs } = await createAdminClient()
      .from('internal_profiles').select('id, full_name, nickname').in('id', staffIds)
    for (const p of profs ?? []) names.set(p.id, p.nickname || p.full_name)
  }

  let ke = 0
  const entries: GriyaRecordEntry[] = rec.map((v) => {
    const kind = getGriyaVisitFormRoute(v.service_type) as 'terapi-awal' | 'session-note'
    if (kind === 'session-note') ke++
    return {
      visitId: v.id as string,
      visitDate: v.visit_date as string,
      visitTime: v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      serviceType: (v.service_type as string) ?? null,
      kind,
      therapistName: v.attending_staff_id ? names.get(v.attending_staff_id as string) ?? null : null,
      griyaSlotId: (v.griya_slot_id as string) ?? null,
      pertemuanKe: kind === 'session-note' ? ke : null,
      attended: v.kehadiran === 'HADIR' || v.status === 'completed',
      terapiAwal: intakeMap.get(v.id as string) ?? null,
      note: noteMap.get(v.id as string) ?? null,
    }
  })
  return { branchId: rec[0].branch_id as string, entries: entries.reverse() }
}
