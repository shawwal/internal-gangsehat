'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { fetchAllRows, fetchInChunks } from '@/lib/supabase/fetchAll'
import { calcAge } from '@/components/patients/detail/constants'
import { SERVICE_TYPE_LABEL } from '@/components/jadwal/types'
import { deriveAdminStatus, fetchLatestComplaints, fetchPackagePositions, type AdminStatus } from '@/lib/internal/visitInsights'
import { SERVICE_TO_CATEGORY, SERVICE_TYPES, getEffectivePackageServiceType } from '@/lib/serviceType'
import { fetchGriyaWeek } from '@/app/actions/griyaJadwal'
import { resolveDay } from '@/components/griya/resolve'
import type { ServiceType } from '@/types'
import { MAX_RANGE_DAYS } from '@/components/jadwalList/types'

export interface JadwalListRow {
  id: string
  visit_date: string
  visit_time: string | null
  patient_id: string
  patient_name: string
  patient_phone: string
  patient_age: string | null
  chief_complaint: string | null
  attending_staff_id: string | null
  attending_staff_name: string | null
  service_type: string | null
  // Display label — Tarif Layanan name when resolvable, else the kategori
  layanan_label: string | null
  // Tarif Layanan (internal_layanan) entry the visit resolves to — see resolveTarif
  tarif_id: string | null
  tarif_nama: string | null
  pertemuan_ke: number
  kurang_bayar: number
  kehadiran: string | null
  admin_status: AdminStatus
  notes: string | null
  order_id: string | null
  branch_id: string
  // Griya Anak: a recurring master slot with no patient_visits row yet for this
  // date (the grid shows it as "Terjadwal"). `id` is synthetic — the hook
  // materializes it via ensureSlotVisit before the first edit.
  griya_slot_id?: string | null
  is_virtual?: boolean
}

export interface JadwalTarifOption {
  id: string
  nama: string
  kategori: string
  is_active: boolean
}

interface TarifRow extends JadwalTarifOption { branch_id: string; harga: number; jumlah_sesi: number | null }

const CLINIC_SERVICE_TYPES = ['TERAPI AWAL KLINIK', 'PAKET KLINIK', 'SESI KLINIK', 'LAINNYA']

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoOf(d)
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (const d = new Date(from + 'T00:00:00'); isoOf(d) <= to; d.setDate(d.getDate() + 1)) out.push(isoOf(d))
  return out
}

/** Run a Map-returning lookup over URL-safe id chunks and merge the results. */
async function mapInChunks<V>(ids: string[], fn: (chunk: string[]) => Promise<Map<string, V>>): Promise<Map<string, V>> {
  const unique = [...new Set(ids)]
  const parts: Promise<Map<string, V>>[] = []
  for (let i = 0; i < unique.length; i += 150) parts.push(fn(unique.slice(i, i + 150)))
  return new Map((await Promise.all(parts)).flatMap((m) => [...m]))
}

/** The branch's Tarif Layanan — the options of the list's Layanan filter. */
export async function fetchJadwalTarifOptions(branchId: string): Promise<JadwalTarifOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_layanan')
    .select('id, nama, kategori, is_active')
    .eq('branch_id', branchId)
    .order('kategori')
    .order('nama')
  return (data ?? []) as JadwalTarifOption[]
}

export async function fetchJadwalListRows(
  dateFrom: string,
  dateTo: string,
  branchId?: string | null,
): Promise<JadwalListRow[]> {
  if (dateTo < dateFrom) [dateFrom, dateTo] = [dateTo, dateFrom]
  const days = datesBetween(dateFrom, dateTo)
  if (days.length > MAX_RANGE_DAYS) throw new Error(`Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari`)

  const supabase = await createClient()

  // Griya Anak builds its day from recurring master slots + visits (see
  // griya-anak/jadwal), not from patient_visits alone — mirror that here so the
  // list shows the same children as the grid.
  let isGriya = false
  if (branchId) {
    const { data: g } = await supabase
      .from('branch_griya_settings').select('enabled').eq('branch_id', branchId).maybeSingle()
    isGriya = !!g?.enabled
  }

  const rawVisits = await fetchAllRows((f, t) => {
    let query = supabase
      .from('patient_visits')
      .select(`
        id, patient_id, branch_id, visit_date, visit_time, service_type, package_id, order_id, layanan_id,
        chief_complaint, diagnosis, treatment, regio, kehadiran, status, notes, attending_staff_id, griya_slot_id,
        internal_profiles!attending_staff_id(full_name, nickname)
      `)
      .gte('visit_date', dateFrom)
      .lte('visit_date', dateTo)
    // Same service types as the jadwal-harian grid — Sport Massage and Home Visit
    // (TA/SESI/PAKET VISIT) have their own pages. Griya uses the same rule as its grid.
    if (!isGriya) query = query.in('service_type', CLINIC_SERVICE_TYPES)
    if (branchId) query = query.eq('branch_id', branchId)
    return query.order('visit_date').order('visit_time').order('id').range(f, t)
  }).catch(() => [])
  const visits = isGriya
    ? rawVisits.filter((v) => v.griya_slot_id != null || (SERVICE_TYPES as string[]).includes(v.service_type ?? ''))
    : rawVisits

  const virtualRows = isGriya && branchId ? await griyaVirtualRows(days, branchId) : []
  if (visits.length === 0) return virtualRows

  // Batch-decrypt patient name/phone/birth date for just these patients.
  const patientIds = [...new Set(visits.map((v) => v.patient_id as string))]
  const patients = await fetchInChunks<{ id: string; encrypted_name: string | null; encrypted_phone: string | null; encrypted_birth_date: string | null }>(
    patientIds,
    (c) => supabase.from('patients').select('id, encrypted_name, encrypted_phone, encrypted_birth_date').in('id', c),
  )

  const nameMap = new Map<string, string>()
  const phoneMap = new Map<string, string>()
  const ageMap = new Map<string, string | null>()
  for (const p of patients) {
    try {
      const dec = decryptPatientPII({
        encrypted_name:       p.encrypted_name ?? '',
        encrypted_phone:      p.encrypted_phone ?? '',
        encrypted_birth_date: p.encrypted_birth_date ?? undefined,
      })
      nameMap.set(p.id, dec.name || 'Pasien')
      phoneMap.set(p.id, dec.phone || '')
      ageMap.set(p.id, dec.birthDate ? calcAge(dec.birthDate) : null)
    } catch {
      nameMap.set(p.id, 'Pasien')
      phoneMap.set(p.id, '')
      ageMap.set(p.id, null)
    }
  }

  // Batch-sum outstanding across all non-rejected transactions per visit.
  const visitIds = visits.map((v) => v.id as string)
  const packageIds = [...new Set(visits.map((v) => v.package_id).filter((id): id is string => !!id))]
  const branchIds = [...new Set(visits.map((v) => v.branch_id as string))]
  type StatusRow = { visit_id: string; status: string }
  const statusRows = (table: string) =>
    fetchInChunks<StatusRow>(visitIds, (c) => supabase.from(table).select('visit_id, status').in('visit_id', c))

  // Pertemuan ke (incl. legacy sessions) and the patient's latest complaint —
  // complaints follow the patient, so repeat visits under a new order still show one.
  const [txns, packagePositions, latestComplaints, packages, tarifRows, ...formRows] = await Promise.all([
    fetchInChunks<{ visit_id: string; type: string; category: string; harga: number | null; outstanding: number | null }>(
      visitIds,
      (c) => supabase.from('transactions').select('visit_id, type, category, harga, outstanding').in('visit_id', c).neq('status', 'rejected'),
    ),
    mapInChunks(packageIds, (c) => fetchPackagePositions(supabase, c)),
    mapInChunks(patientIds, (c) => fetchLatestComplaints(supabase, c)),
    fetchInChunks<{ id: string; package_name: string; total_sessions: number; category: string | null; layanan_id: string | null }>(
      packageIds,
      (c) => supabase.from('patient_packages').select('id, package_name, total_sessions, category, layanan_id').in('id', c),
    ),
    supabase.from('internal_layanan').select('id, branch_id, nama, kategori, harga, jumlah_sesi, is_active').in('branch_id', branchIds)
      .then(({ data }) => (data ?? []) as TarifRow[]),
    statusRows('terapi_awal_assessments'),
    statusRows('session_notes'),
    statusRows('griya_terapi_awal'),
    statusRows('griya_session_notes'),
  ])

  const outstandingMap = new Map<string, number>()
  const incomeByVisit = new Map<string, { category: string; harga: number | null }>()
  for (const t of txns) {
    outstandingMap.set(t.visit_id, (outstandingMap.get(t.visit_id) ?? 0) + (t.outstanding ?? 0))
    if (t.type === 'income' && !incomeByVisit.has(t.visit_id)) incomeByVisit.set(t.visit_id, t)
  }

  // Record-form status per visit; 'completed' wins if a visit has more than one row.
  const formStatusMap = new Map<string, string>()
  for (const r of formRows.flat()) {
    if (formStatusMap.get(r.visit_id) !== 'completed') formStatusMap.set(r.visit_id, r.status)
  }

  const tarifById = new Map(tarifRows.map((l) => [l.id, l]))
  const packageMap = new Map(packages.map((p) => [p.id, p]))

  /** One entry of `list`, or null when it's empty or ambiguous. */
  const only = (list: TarifRow[]) => (list.length === 1 ? list[0] : null)

  // Clinic visits don't store their layanan (only Sport Massage / online
  // bookings do), so resolve the Tarif Layanan entry from what the visit was
  // sold as: its package (linked Layanan, else same name / size), its payment (category + price,
  // the finance pages' rule), or its service type's kategori.
  function resolveTarif(v: (typeof visits)[number]): TarifRow | null {
    if (v.layanan_id && tarifById.has(v.layanan_id)) return tarifById.get(v.layanan_id)!
    const inBranch = (kategori: string) => tarifRows.filter((l) => l.branch_id === v.branch_id && l.kategori === kategori)

    const pkg = v.package_id ? packageMap.get(v.package_id) : undefined
    if (pkg?.layanan_id && tarifById.has(pkg.layanan_id)) return tarifById.get(pkg.layanan_id)!
    if (pkg?.category) {
      const sameCat = inBranch(pkg.category)
      const hit = only(sameCat.filter((l) => l.nama === pkg.package_name))
        ?? only(sameCat.filter((l) => l.jumlah_sesi === pkg.total_sessions))
        ?? only(sameCat)
      if (hit) return hit
    }

    const pay = incomeByVisit.get(v.id)
    if (pay) {
      const sameCat = inBranch(pay.category)
      const hit = only(sameCat.filter((l) => Number(l.harga) === Number(pay.harga))) ?? only(sameCat)
      if (hit) return hit
    }

    const st = getEffectivePackageServiceType(v.service_type, v.package_id)
    const kategori = st ? SERVICE_TO_CATEGORY[st as ServiceType] : undefined
    if (!kategori) return null
    const sameCat = inBranch(kategori)
    return only(sameCat.filter((l) => l.is_active)) ?? only(sameCat)
  }

  const realRows: JadwalListRow[] = visits.map((v) => {
    const staff = v.internal_profiles as unknown as { full_name: string; nickname: string | null } | null
    const tarif = resolveTarif(v)
    const booked = v.layanan_id ? tarifById.get(v.layanan_id) : undefined
    return {
      id:                    v.id,
      visit_date:            v.visit_date,
      visit_time:            v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      patient_id:            v.patient_id,
      patient_name:          nameMap.get(v.patient_id) ?? 'Pasien',
      patient_phone:         phoneMap.get(v.patient_id) ?? '',
      patient_age:           ageMap.get(v.patient_id) ?? null,
      chief_complaint:       v.chief_complaint?.trim() || latestComplaints.get(v.patient_id) || null,
      attending_staff_id:    v.attending_staff_id ?? null,
      attending_staff_name:  staff?.nickname || staff?.full_name || null,
      service_type:          v.service_type,
      // Tarif Layanan name when resolvable (booked → package → payment), else the kategori.
      layanan_label:         booked?.nama ?? tarif?.nama
        ?? (v.package_id ? packageMap.get(v.package_id)?.package_name : undefined)
        ?? (v.service_type ? SERVICE_TYPE_LABEL[v.service_type] ?? v.service_type : null),
      tarif_id:              tarif?.id ?? null,
      tarif_nama:            tarif?.nama ?? null,
      pertemuan_ke:          v.package_id ? (packagePositions.get(v.id)?.pertemuan ?? 1) : 1,
      kurang_bayar:          outstandingMap.get(v.id) ?? 0,
      kehadiran:             v.kehadiran,
      admin_status:          deriveAdminStatus(v, formStatusMap.get(v.id)),
      notes:                 v.notes,
      order_id:              v.order_id,
      branch_id:             v.branch_id,
      griya_slot_id:         v.griya_slot_id ?? null,
    }
  })

  return [...realRows, ...virtualRows].sort((a, b) =>
    a.visit_date.localeCompare(b.visit_date) || (a.visit_time ?? '99:99').localeCompare(b.visit_time ?? '99:99'))
}

/** Griya master-slot occurrences on `dates` that have no visit row yet — the
 *  "Terjadwal" cells of the grid, with the therapist resolved by the same rotation. */
async function griyaVirtualRows(dates: string[], branchId: string): Promise<JadwalListRow[]> {
  const mondays = [...new Set(dates.map(mondayOf))]
  const weeks = new Map(await Promise.all(mondays.map(async (m) => [m, await fetchGriyaWeek(m, branchId)] as const)))

  const out: JadwalListRow[] = []
  for (const date of dates) {
    const week = weeks.get(mondayOf(date))!
    const { cells, unassigned } = resolveDay(week, date)
    const staffName = new Map(week.therapists.map((t) => [t.therapist_id, t.nickname || t.full_name]))

    for (const c of [...[...cells.values()].flat(), ...unassigned]) {
      if (c.state !== 'scheduled' || c.visit || !c.slot) continue
      const s = c.slot
      out.push({
        id:                   `griya:${s.id}:${date}`,
        visit_date:           date,
        visit_time:           c.hour || s.slot_time,
        patient_id:           s.patient_id,
        patient_name:         s.patient_name,
        patient_phone:        s.patient_phone ?? '',
        patient_age:          null,
        chief_complaint:      null,
        attending_staff_id:   c.therapistId || null,
        attending_staff_name: c.therapistId ? staffName.get(c.therapistId) ?? null : null,
        service_type:         s.service_type,
        layanan_label:        s.package_id ? 'Paket' : (s.service_type ? SERVICE_TYPE_LABEL[s.service_type] ?? s.service_type : null),
        tarif_id:             null,
        tarif_nama:           null,
        pertemuan_ke:         1,
        kurang_bayar:         0,
        kehadiran:            null,
        admin_status:         'BELUM_DIPERIKSA',
        notes:                s.notes,
        order_id:             null,
        branch_id:            branchId,
        griya_slot_id:        s.id,
        is_virtual:           true,
      })
    }
  }
  return out
}
