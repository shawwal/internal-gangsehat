import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

const TA_TYPES = new Set(['TERAPI AWAL', 'TA VISIT'])
const SESI_TYPES = new Set(['SESI TERAPI', 'SESI VISIT'])

export const isTaServiceType = (t: string | null | undefined) => TA_TYPES.has(t ?? '')
export const isSesiServiceType = (t: string | null | undefined) => SESI_TYPES.has(t ?? '')

/**
 * Latest complaint per patient. Preference order:
 *   1. most recent non-empty chief_complaint from a TA visit
 *   2. most recent non-empty chief_complaint from any visit
 *   3. patients.keluhan (entered by the patient at registration)
 * Complaints follow the patient, not the order — so a repeat visit under a new
 * order ID still shows what the patient came in for.
 */
export async function fetchLatestComplaints(supabase: Supabase, patientIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (patientIds.length === 0) return result

  const [{ data: visits }, { data: patients }] = await Promise.all([
    supabase
      .from('patient_visits')
      .select('patient_id, service_type, chief_complaint, visit_date, visit_time')
      .in('patient_id', patientIds)
      .not('chief_complaint', 'is', null)
      .neq('chief_complaint', '')
      .order('visit_date', { ascending: false })
      .order('visit_time', { ascending: false, nullsFirst: false }),
    supabase.from('patients').select('id, keluhan').in('id', patientIds),
  ])

  const fromTa  = new Map<string, string>()
  const fromAny = new Map<string, string>()
  for (const v of visits ?? []) {
    const c = (v.chief_complaint as string | null)?.trim()
    if (!c) continue
    if (!fromAny.has(v.patient_id)) fromAny.set(v.patient_id, c)
    if (isTaServiceType(v.service_type) && !fromTa.has(v.patient_id)) fromTa.set(v.patient_id, c)
  }
  const fromProfile = new Map<string, string>()
  for (const p of patients ?? []) {
    const k = (p.keluhan as string | null)?.trim()
    if (k) fromProfile.set(p.id, k)
  }

  for (const id of patientIds) {
    const c = fromTa.get(id) ?? fromAny.get(id) ?? fromProfile.get(id)
    if (c) result.set(id, c)
  }
  return result
}

/**
 * Position of each visit within its package: `pertemuan` is the 1-based
 * session number (including sessions migrated from the old system), `total`
 * is the package size (5/10/20).
 */
export async function fetchPackagePositions(
  supabase: Supabase,
  packageIds: string[],
): Promise<Map<string, { pertemuan: number; total: number | null }>> {
  const result = new Map<string, { pertemuan: number; total: number | null }>()
  if (packageIds.length === 0) return result

  const [{ data: pkgVisits }, { data: pkgs }] = await Promise.all([
    supabase
      .from('patient_visits')
      .select('id, package_id, visit_date, visit_time')
      .in('package_id', packageIds)
      .neq('status', 'cancelled'),
    supabase
      .from('patient_packages_with_stats')
      .select('id, total_sessions, legacy_used_sessions')
      .in('id', packageIds),
  ])

  const pkgMap = new Map<string, { total: number | null; legacy: number }>()
  for (const p of pkgs ?? []) {
    pkgMap.set(p.id, { total: p.total_sessions ?? null, legacy: p.legacy_used_sessions ?? 0 })
  }

  const byPackage = new Map<string, { id: string; key: string }[]>()
  for (const v of pkgVisits ?? []) {
    const pid = v.package_id as string
    const list = byPackage.get(pid) ?? []
    list.push({ id: v.id, key: `${v.visit_date} ${v.visit_time ?? '00:00'}` })
    byPackage.set(pid, list)
  }
  for (const [pid, list] of byPackage) {
    list.sort((a, b) => a.key.localeCompare(b.key))
    const info = pkgMap.get(pid)
    list.forEach((v, i) => result.set(v.id, { pertemuan: (info?.legacy ?? 0) + i + 1, total: info?.total ?? null }))
  }
  return result
}

/**
 * Visit IDs (from `visits`) that are a SESI booked right after the patient's TA —
 * i.e. the patient's previous non-cancelled visit was a TA.
 */
export async function fetchFirstSesiAfterTa(
  supabase: Supabase,
  visits: { id: string; patient_id: string; visit_date: string; visit_time: string | null; service_type: string | null; package_id: string | null }[],
): Promise<Set<string>> {
  const result = new Set<string>()
  const candidates = visits.filter((v) => isSesiServiceType(v.service_type) && !v.package_id)
  if (candidates.length === 0) return result

  const maxDate = candidates.reduce((m, v) => (v.visit_date > m ? v.visit_date : m), candidates[0].visit_date)
  const { data: history } = await supabase
    .from('patient_visits')
    .select('id, patient_id, visit_date, visit_time, service_type')
    .in('patient_id', [...new Set(candidates.map((v) => v.patient_id))])
    .lte('visit_date', maxDate)
    .neq('status', 'cancelled')

  const byPatient = new Map<string, { id: string; key: string; service_type: string | null }[]>()
  for (const h of history ?? []) {
    const list = byPatient.get(h.patient_id) ?? []
    list.push({ id: h.id, key: `${h.visit_date} ${h.visit_time ?? '00:00'}`, service_type: h.service_type })
    byPatient.set(h.patient_id, list)
  }
  for (const list of byPatient.values()) list.sort((a, b) => a.key.localeCompare(b.key))

  for (const c of candidates) {
    const list = byPatient.get(c.patient_id) ?? []
    const idx = list.findIndex((h) => h.id === c.id)
    if (idx > 0 && isTaServiceType(list[idx - 1].service_type)) result.add(c.id)
  }
  return result
}
