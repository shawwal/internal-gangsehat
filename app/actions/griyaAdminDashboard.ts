'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { getGriyaVisitFormRoute, type GriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import { resolveGriyaBranchId } from '@/app/actions/griyaJadwal'

const ADMIN_ROLES = ['admin', 'director', 'manager']
const BACKLOG_DAYS = 7
const REMINDER_TITLE = 'Rekam Medis Griya Belum Diisi'

export type RecordState = 'done' | 'draft' | 'missing'

export interface PendingRecord {
  visitId: string
  staffId: string
  patientId: string
  patientName: string
  visitDate: string
  serviceType: string | null
  kind: GriyaVisitFormRoute
  state: 'draft' | 'missing'
}

export interface GriyaAdminRecords {
  /** Record state for every attended visit on the selected day (visitId → state). */
  stateByVisit: Record<string, RecordState>
  /** Attended visits whose Terapi Awal / rekam medis isn't completed, selected day + prior 7 days. */
  pending: PendingRecord[]
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function authAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' as const }
  const { data: profile } = await supabase.from('internal_profiles').select('role').eq('id', user.id).single()
  if (!profile || !ADMIN_ROLES.includes(profile.role)) return { error: 'Tidak memiliki akses' as const }
  return { supabase }
}

async function collect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  fromIso: string,
  toIso: string,
): Promise<{ stateByVisit: Record<string, RecordState>; pending: PendingRecord[] }> {
  const { data: visits } = await supabase
    .from('patient_visits')
    .select('id, patient_id, attending_staff_id, visit_date, service_type, status, kehadiran')
    .eq('branch_id', branchId)
    .gte('visit_date', fromIso)
    .lte('visit_date', toIso)
    .or('status.eq.completed,kehadiran.eq.HADIR')
  const attended = (visits ?? []).filter((v) => getGriyaVisitFormRoute(v.service_type))
  if (attended.length === 0) return { stateByVisit: {}, pending: [] }

  const ids = attended.map((v) => v.id as string)
  const [notes, intakes] = await Promise.all([
    supabase.from('griya_session_notes').select('visit_id, status').in('visit_id', ids),
    supabase.from('griya_terapi_awal').select('visit_id, status').in('visit_id', ids),
  ])
  const noteStatus = new Map((notes.data ?? []).map((r) => [r.visit_id as string, r.status as string]))
  const intakeStatus = new Map((intakes.data ?? []).map((r) => [r.visit_id as string, r.status as string]))

  const stateByVisit: Record<string, RecordState> = {}
  const pendingRaw: Omit<PendingRecord, 'patientName'>[] = []
  for (const v of attended) {
    const kind = getGriyaVisitFormRoute(v.service_type)!
    const st = (kind === 'terapi-awal' ? intakeStatus : noteStatus).get(v.id as string)
    const state: RecordState = st === 'completed' ? 'done' : st === 'draft' ? 'draft' : 'missing'
    stateByVisit[v.id as string] = state
    if (state !== 'done' && v.attending_staff_id) {
      pendingRaw.push({
        visitId: v.id as string, staffId: v.attending_staff_id as string, patientId: v.patient_id as string,
        visitDate: v.visit_date as string, serviceType: (v.service_type as string) ?? null, kind, state,
      })
    }
  }

  const nameMap = new Map<string, string>()
  const patientIds = [...new Set(pendingRaw.map((p) => p.patientId))]
  if (patientIds.length > 0) {
    const { data: patients } = await supabase.from('patients').select('id, encrypted_name').in('id', patientIds)
    for (const p of patients ?? []) {
      try { nameMap.set(p.id, decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: '' }).name || 'Anak') }
      catch { nameMap.set(p.id, 'Anak') }
    }
  }
  const pending = pendingRaw
    .map((p) => ({ ...p, patientName: nameMap.get(p.patientId) ?? 'Anak' }))
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate))
  return { stateByVisit, pending }
}

export async function fetchGriyaAdminRecords(dateIso: string): Promise<GriyaAdminRecords & { error?: string }> {
  const a = await authAdmin()
  if ('error' in a) return { stateByVisit: {}, pending: [], error: a.error }
  const branchId = await resolveGriyaBranchId()
  if (!branchId) return { stateByVisit: {}, pending: [] }
  const { stateByVisit, pending } = await collect(a.supabase, branchId, addDaysIso(dateIso, -BACKLOG_DAYS), dateIso)
  const day: Record<string, RecordState> = {}
  for (const [id, s] of Object.entries(stateByVisit)) day[id] = s
  return { stateByVisit: day, pending }
}

/** Notifies therapists about unfinished Terapi Awal / rekam medis. Recomputed server-side. */
export async function sendGriyaRecordReminders(
  dateIso: string,
  staffId?: string,
): Promise<{ sent: number; skipped: number; error: string | null }> {
  const a = await authAdmin()
  if ('error' in a) return { sent: 0, skipped: 0, error: a.error ?? 'Tidak memiliki akses' }
  const branchId = await resolveGriyaBranchId()
  if (!branchId) return { sent: 0, skipped: 0, error: 'Cabang Griya Anak tidak ditemukan' }

  const { pending } = await collect(a.supabase, branchId, addDaysIso(dateIso, -BACKLOG_DAYS), dateIso)
  const byStaff = new Map<string, PendingRecord[]>()
  for (const p of pending) {
    if (staffId && p.staffId !== staffId) continue
    byStaff.set(p.staffId, [...(byStaff.get(p.staffId) ?? []), p])
  }

  const admin = createAdminClient()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  let sent = 0, skipped = 0
  for (const [uid, items] of byStaff) {
    const { data: existing } = await admin.from('user_notifications').select('id')
      .eq('user_id', uid).eq('title', REMINDER_TITLE).gte('created_at', todayStart.toISOString()).limit(1)
    if (existing && existing.length > 0) { skipped++; continue }

    const ta = items.filter((i) => i.kind === 'terapi-awal').length
    const rm = items.length - ta
    const parts = [ta > 0 ? `${ta} Terapi Awal` : '', rm > 0 ? `${rm} rekam medis` : ''].filter(Boolean).join(' dan ')
    const names = [...new Set(items.map((i) => i.patientName))].slice(0, 4).join(', ')
    await admin.from('user_notifications').insert({
      user_id: uid,
      title: REMINDER_TITLE,
      message: `Anda memiliki ${parts} yang belum diselesaikan: ${names}${items.length > 4 ? ', dll.' : ''}`,
      link: '/griya-anak/dashboard',
    })
    sent++
  }
  return { sent, skipped, error: null }
}
