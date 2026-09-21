'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { normalizeBirthDate } from '@/lib/dates'
import { getGriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import { resolveGriyaBranchId, type Discipline, type Hari } from '@/app/actions/griyaJadwal'

export interface MyStudentSlot {
  hari: Hari
  time: string            // 'HH:MM'
  discipline: Discipline
}

export interface MyStudent {
  patientId: string
  name: string
  phone: string
  gender: string | null
  birthDate: string | null
  keluhan: string | null
  status: 'active' | 'graduated' | 'inactive'
  /** Attended sessions handled by me — all time / this month. */
  sessionsTotal: number
  sessionsMonth: number
  /** Sessions where the child didn't come (alpa / izin) while assigned to me. */
  missed: number
  firstVisit: string | null
  lastVisit: string | null        // last attended
  nextVisit: string | null        // next scheduled (>= today)
  nextVisitTime: string | null
  /** Attended visits of mine whose Terapi Awal / rekam medis isn't completed. */
  pendingRecords: number
  /** Where to send the therapist to finish the oldest pending record. */
  pendingHref: string | null
  slots: MyStudentSlot[]
  disciplines: Discipline[]
}

export interface MyStudentsResult {
  students: MyStudent[]
  today: string
  error?: string
}

type VisitRow = {
  id: string
  patient_id: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  status: string
  kehadiran: string | null
}

function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/**
 * Every child the signed-in Griya Anak therapist has handled (i.e. is the
 * attending_staff_id of at least one visit), with per-child counts, last/next
 * visit and unfinished rekam medis. Aggregated server-side so names stay
 * decrypted server-only; the list is small (one therapist's caseload) so the
 * client filters/searches it locally.
 */
export async function fetchMyGriyaStudents(): Promise<MyStudentsResult> {
  const today = jakartaToday()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { students: [], today, error: 'Tidak terautentikasi' }

  const branchId = await resolveGriyaBranchId()
  if (!branchId) return { students: [], today }

  // PostgREST caps a request at 1000 rows — page through.
  const visits: VisitRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('patient_visits')
      .select('id, patient_id, visit_date, visit_time, service_type, status, kehadiran')
      .eq('branch_id', branchId)
      .eq('attending_staff_id', user.id)
      .order('visit_date', { ascending: true })
      .range(from, from + 999)
    if (error) return { students: [], today, error: error.message }
    visits.push(...((data ?? []) as VisitRow[]))
    if (!data || data.length < 1000) break
  }
  if (visits.length === 0) return { students: [], today }

  const isAttended = (v: VisitRow) => v.kehadiran === 'HADIR' || v.status === 'completed'
  const isMissed = (v: VisitRow) => v.status === 'no_show' || (v.status === 'cancelled' && v.kehadiran === 'TIDAK HADIR')

  // Which attended visits still lack a completed record.
  const needsForm = visits.filter((v) => isAttended(v) && getGriyaVisitFormRoute(v.service_type))
  const doneVisitIds = new Set<string>()
  for (const ids of chunk(needsForm.map((v) => v.id), 200)) {
    const [notes, intakes] = await Promise.all([
      supabase.from('griya_session_notes').select('visit_id, status').in('visit_id', ids),
      supabase.from('griya_terapi_awal').select('visit_id, status').in('visit_id', ids),
    ])
    for (const r of [...(notes.data ?? []), ...(intakes.data ?? [])]) {
      if (r.status === 'completed') doneVisitIds.add(r.visit_id as string)
    }
  }

  const monthPrefix = today.slice(0, 7)
  const byPatient = new Map<string, VisitRow[]>()
  for (const v of visits) byPatient.set(v.patient_id, [...(byPatient.get(v.patient_id) ?? []), v])
  const patientIds = [...byPatient.keys()]

  // Roster status + demographics (names decrypted here, server-side only).
  const info = new Map<string, {
    status: MyStudent['status']; name: string; phone: string; gender: string | null; birthDate: string | null; keluhan: string | null
  }>()
  const slotMap = new Map<string, MyStudentSlot[]>()
  for (const ids of chunk(patientIds, 100)) {
    const [roster, slots] = await Promise.all([
      supabase
        .from('griya_students')
        .select('patient_id, status, patients!inner(encrypted_name, encrypted_phone, encrypted_birth_date, gender, keluhan)')
        .eq('branch_id', branchId)
        .in('patient_id', ids),
      supabase
        .from('griya_schedule_slots')
        .select('patient_id, hari, slot_time, discipline')
        .eq('branch_id', branchId)
        .eq('status', 'active')
        .in('patient_id', ids),
    ])
    for (const row of (roster.data ?? []) as unknown as {
      patient_id: string; status: MyStudent['status']
      patients: { encrypted_name: string | null; encrypted_phone: string | null; encrypted_birth_date: string | null; gender: string | null; keluhan: string | null }
    }[]) {
      let name = 'Anak', phone = '', birthDate: string | null = null
      try {
        const d = decryptPatientPII({
          encrypted_name: row.patients.encrypted_name ?? '',
          encrypted_phone: row.patients.encrypted_phone ?? '',
          encrypted_birth_date: row.patients.encrypted_birth_date ?? undefined,
        })
        name = d.name || 'Anak'; phone = d.phone || ''; birthDate = normalizeBirthDate(d.birthDate)
      } catch { /* keep fallbacks */ }
      info.set(row.patient_id, {
        status: row.status, name, phone, gender: row.patients.gender ?? null, birthDate, keluhan: row.patients.keluhan ?? null,
      })
    }
    for (const s of slots.data ?? []) {
      const pid = s.patient_id as string
      slotMap.set(pid, [...(slotMap.get(pid) ?? []), {
        hari: s.hari as Hari, time: String(s.slot_time).slice(0, 5), discipline: s.discipline as Discipline,
      }])
    }
  }

  const students: MyStudent[] = []
  for (const [patientId, vs] of byPatient) {
    const meta = info.get(patientId)
    if (!meta) continue // visit for a non-Griya patient — not part of this roster

    const attended = vs.filter(isAttended)
    const upcoming = vs
      .filter((v) => v.status === 'scheduled' && v.visit_date >= today)
      .sort((a, b) => a.visit_date.localeCompare(b.visit_date) || (a.visit_time ?? '').localeCompare(b.visit_time ?? ''))
    const pending = attended.filter((v) => getGriyaVisitFormRoute(v.service_type) && !doneVisitIds.has(v.id))
    const oldest = pending[0]
    const slots = slotMap.get(patientId) ?? []

    students.push({
      patientId,
      name: meta.name,
      phone: meta.phone,
      gender: meta.gender,
      birthDate: meta.birthDate,
      keluhan: meta.keluhan,
      status: meta.status,
      sessionsTotal: attended.length,
      sessionsMonth: attended.filter((v) => v.visit_date.startsWith(monthPrefix)).length,
      missed: vs.filter(isMissed).length,
      firstVisit: vs[0]?.visit_date ?? null,
      lastVisit: attended.length ? attended[attended.length - 1].visit_date : null,
      nextVisit: upcoming[0]?.visit_date ?? null,
      nextVisitTime: upcoming[0]?.visit_time ? String(upcoming[0].visit_time).slice(0, 5) : null,
      pendingRecords: pending.length,
      pendingHref: oldest
        ? getGriyaVisitFormRoute(oldest.service_type) === 'terapi-awal'
          ? `/griya-anak/siswa/${patientId}/terapi-awal/${oldest.id}`
          : `/griya-anak/siswa/${patientId}/rekam-medis`
        : null,
      slots: slots.sort((a, b) => a.time.localeCompare(b.time)),
      disciplines: [...new Set(slots.map((s) => s.discipline))],
    })
  }

  students.sort((a, b) => a.name.localeCompare(b.name, 'id'))
  return { students, today }
}
