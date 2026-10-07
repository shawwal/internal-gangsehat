'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import type { VisitStatus } from '@/types'
import { isRegioRequired } from '@/lib/visitRouting'
import { generateOrderId } from '@/lib/internal/orderId'
import { logActivity } from '@/lib/activityLog'
import { countBookedSessions } from '@/app/actions/packages'
import { fetchFirstSesiAfterTa, fetchPackagePositions, isTaServiceType } from '@/lib/internal/visitInsights'

async function decryptedPatientName(supabase: Awaited<ReturnType<typeof createClient>>, patientId: string | null | undefined): Promise<string> {
  if (!patientId) return 'Pasien'
  const { data: p } = await supabase.from('patients').select('encrypted_name, encrypted_phone').eq('id', patientId).single()
  if (!p) return 'Pasien'
  try {
    return decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' }).name || 'Pasien'
  } catch {
    return 'Pasien'
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface VisitTransaction {
  id: string
  harga: number | null
  discount: number | null
  amount: number | null
  payment_method: string | null
  payment_status: string | null
  penjamin: string | null
  description: string | null
  transaction_date: string
  receipt_url: string | null
}

export interface DailyVisit {
  id: string
  patient_id: string
  patient_name: string
  patient_phone: string
  branch_id: string
  visit_date: string
  visit_time: string | null    // HH:MM or null
  service_type: string | null
  package_id: string | null    // set → visit is part of a package
  order_id: string | null
  // Sport Massage service type booked (internal_layanan row) — null otherwise
  layanan_id: string | null
  layanan_nama: string | null
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  regio: string | null
  attending_staff_id: string | null
  status: VisitStatus
  notes: string | null
  kehadiran: string | null
  // Payment info — populated by fetchDailyVisits
  has_payment: boolean
  visit_payment_status: string | null
  visit_package_price: number | null
  visit_package_outstanding: number | null
  visit_transaction: VisitTransaction | null
  // Whether the linked package's payment gate is satisfied (legacy-exempt or has
  // a confirmed transaction) — null when package_id is null. See
  // patient_packages_with_stats.payment_ok.
  package_payment_ok: boolean | null
  // "Pasien yang perlu diperhatikan hari ini": TA, first SESI after a TA, or the
  // last session of a package.
  is_priority: boolean
}

const PACKAGE_CATEGORIES = new Set(['PAKET VISIT', 'PAKET KLINIK'])

// TA (initial assessment) visits must always be billed on their own — never
// drawn from an existing package — regardless of what the client sends.
const NO_PACKAGE_SERVICE_TYPES = new Set(['TERAPI AWAL', 'TA VISIT'])
function resolvePackageId(serviceType: string | null | undefined, packageId: string | null | undefined) {
  if (NO_PACKAGE_SERVICE_TYPES.has(serviceType ?? '')) return null
  return packageId ?? null
}

// Rejects linking more visits to a package than it has sessions. Counts every
// live linked visit regardless of payment — the view's used_sessions stays 0
// for unpaid packages, which let one P1 absorb 12 sessions.
async function checkPackageCapacity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputs: { service_type?: string | null; package_id?: string | null }[],
): Promise<string | null> {
  const wanted = new Map<string, number>()
  for (const i of inputs) {
    const id = resolvePackageId(i.service_type, i.package_id)
    if (id) wanted.set(id, (wanted.get(id) ?? 0) + 1)
  }
  if (wanted.size === 0) return null

  const ids = [...wanted.keys()]
  const [{ data: pkgs }, booked] = await Promise.all([
    supabase.from('patient_packages').select('id, package_name, total_sessions, legacy_used_sessions').in('id', ids),
    countBookedSessions(supabase, ids),
  ])
  for (const p of pkgs ?? []) {
    const remaining = p.total_sessions - (p.legacy_used_sessions ?? 0) - (booked.get(p.id) ?? 0)
    if ((wanted.get(p.id) ?? 0) > remaining) {
      return `Paket "${p.package_name}" hanya tersisa ${Math.max(0, remaining)} sesi. Buat paket baru untuk pasien ini terlebih dahulu.`
    }
  }
  return null
}

export interface CreateVisitInput {
  patient_id: string
  branch_id: string
  attending_staff_id: string | null
  visit_date: string
  visit_time: string | null
  service_type?: string | null
  shift?: string | null
  chief_complaint: string | null
  status: VisitStatus
  notes: string | null
  package_id?: string | null
  kehadiran?: string | null
  layanan_id?: string | null
}

// ── Fetch all visits for a date with decrypted patient names ───────────────────
export async function fetchDailyVisits(
  date: string,
  branchId?: string | null,
  opts?: { serviceTypes?: string[] },
): Promise<DailyVisit[]> {
  const supabase = await createClient()

  let query = supabase
    .from('patient_visits')
    .select('id, patient_id, attending_staff_id, visit_date, visit_time, service_type, package_id, order_id, layanan_id, chief_complaint, diagnosis, treatment, regio, status, notes, branch_id, kehadiran')
    .eq('visit_date', date)
    .order('visit_time', { ascending: true })
  if (branchId) query = query.eq('branch_id', branchId)
  if (opts?.serviceTypes?.length) query = query.in('service_type', opts.serviceTypes)
  const { data: visits, error } = await query

  if (error || !visits || visits.length === 0) return []

  // Batch-decrypt patient names
  const patientIds = [...new Set(visits.map((v) => v.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, encrypted_phone')
    .in('id', patientIds)

  const nameMap = new Map<string, string>()
  const phoneMap = new Map<string, string>()
  for (const p of patients ?? []) {
    try {
      const dec = decryptPatientPII({
        encrypted_name:  p.encrypted_name  ?? '',
        encrypted_phone: p.encrypted_phone ?? '',
      })
      nameMap.set(p.id, dec.name || 'Pasien')
      phoneMap.set(p.id, dec.phone || '')
    } catch {
      nameMap.set(p.id, 'Pasien')
      phoneMap.set(p.id, '')
    }
  }

  // Batch-fetch payment status for all visits
  const visitIds = visits.map((v) => v.id)
  const { data: txns } = await supabase
    .from('transactions')
    .select('id, visit_id, category, harga, discount, amount, payment_method, payment_status, penjamin, description, transaction_date, receipt_url, outstanding, status, created_at')
    .in('visit_id', visitIds)
    .neq('status', 'rejected')
    .order('created_at', { ascending: true })

  // Per-visit: last non-rejected transaction wins for display.
  // Package-sale transactions (from PostAssessmentPackageDialog) are linked
  // via visit_id for traceability, but they must NOT feed into the visit's
  // own payment badge — a package's DP/outstanding balance is unrelated to
  // whether the source visit itself (e.g. the TA assessment) was paid.
  const payMap = new Map<string, { payment_status: string | null; all_paid: boolean }>()
  const packageMap = new Map<string, { harga: number; outstanding: number }>()
  // Most recent non-package transaction per visit — offered up for editing
  // rather than always stacking another payment row.
  const latestTxnMap = new Map<string, VisitTransaction>()
  for (const t of txns ?? []) {
    const vid = t.visit_id as string
    if (PACKAGE_CATEGORIES.has(t.category ?? '')) {
      if (t.harga != null) packageMap.set(vid, { harga: t.harga, outstanding: t.outstanding ?? 0 })
      continue
    }
    const existing = payMap.get(vid)
    if (!existing) {
      payMap.set(vid, { payment_status: t.payment_status, all_paid: t.outstanding === 0 })
    } else {
      payMap.set(vid, {
        payment_status: t.payment_status ?? existing.payment_status,
        all_paid: existing.all_paid && t.outstanding === 0,
      })
    }
    latestTxnMap.set(vid, {
      id:               t.id,
      harga:            t.harga,
      discount:         t.discount,
      amount:           t.amount,
      payment_method:   t.payment_method,
      payment_status:   t.payment_status,
      penjamin:         t.penjamin,
      description:      t.description,
      transaction_date: t.transaction_date,
      receipt_url:      t.receipt_url,
    })
  }

  // Batch-fetch whether each linked package's payment gate is satisfied —
  // legacy-exempt (migrated, no order_id) or has a confirmed transaction.
  // See patient_packages_with_stats.payment_ok (supabase/079-...).
  const packageIds = [...new Set(visits.map((v) => v.package_id).filter((id): id is string => !!id))]
  const packagePaymentOkMap = new Map<string, boolean>()
  if (packageIds.length > 0) {
    const { data: pkgs } = await supabase
      .from('patient_packages_with_stats')
      .select('id, payment_ok')
      .in('id', packageIds)
    for (const p of pkgs ?? []) packagePaymentOkMap.set(p.id, !!p.payment_ok)
  }

  // Priority flags — last package session and first SESI after TA
  const [packagePositions, firstSesiAfterTa] = await Promise.all([
    fetchPackagePositions(supabase, packageIds),
    fetchFirstSesiAfterTa(supabase, visits.map((v) => ({
      id: v.id, patient_id: v.patient_id, visit_date: v.visit_date,
      visit_time: v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      service_type: v.service_type, package_id: v.package_id ?? null,
    }))),
  ])
  const isLastPackageSession = (visitId: string) => {
    const pos = packagePositions.get(visitId)
    return !!pos && pos.total != null && pos.pertemuan === pos.total
  }

  // Names of the booked Sport Massage service types
  const layananIds = [...new Set(visits.map((v) => v.layanan_id).filter((id): id is string => !!id))]
  const layananNameMap = new Map<string, string>()
  if (layananIds.length > 0) {
    const { data: layanan } = await supabase
      .from('internal_layanan')
      .select('id, nama')
      .in('id', layananIds)
    for (const l of layanan ?? []) layananNameMap.set(l.id, l.nama)
  }

  return visits.map((v) => {
    const pay = payMap.get(v.id)
    const pkg = packageMap.get(v.id)
    return {
      id:                   v.id,
      patient_id:           v.patient_id,
      patient_name:         nameMap.get(v.patient_id) ?? 'Pasien',
      patient_phone:        phoneMap.get(v.patient_id) ?? '',
      branch_id:            v.branch_id,
      visit_date:           v.visit_date,
      visit_time:           v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      service_type:         v.service_type,
      package_id:           v.package_id ?? null,
      order_id:             v.order_id ?? null,
      layanan_id:           v.layanan_id ?? null,
      layanan_nama:         v.layanan_id ? (layananNameMap.get(v.layanan_id) ?? null) : null,
      chief_complaint:      v.chief_complaint,
      diagnosis:            v.diagnosis,
      treatment:            v.treatment,
      regio:                v.regio,
      attending_staff_id:   v.attending_staff_id,
      status:               v.status as VisitStatus,
      notes:                v.notes,
      kehadiran:            v.kehadiran ?? null,
      has_payment:          !!pay,
      visit_payment_status: pay ? (pay.all_paid ? 'LUNAS' : pay.payment_status) : null,
      visit_package_price:       pkg?.harga ?? null,
      visit_package_outstanding: pkg?.outstanding ?? null,
      visit_transaction:    latestTxnMap.get(v.id) ?? null,
      package_payment_ok:  v.package_id ? (packagePaymentOkMap.get(v.package_id) ?? false) : null,
      is_priority:          isTaServiceType(v.service_type) || firstSesiAfterTa.has(v.id)
        || (!!v.package_id && isLastPackageSession(v.id)),
    }
  })
}

// ── Create a new visit ─────────────────────────────────────────────────────────
export async function createVisit(input: CreateVisitInput): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const capacityError = await checkPackageCapacity(supabase, [input])
  if (capacityError) return { error: capacityError }
  const orderId = await generateOrderId(supabase)

  const { data, error } = await supabase.from('patient_visits').insert({
    patient_id:          input.patient_id,
    branch_id:           input.branch_id,
    attending_staff_id:  input.attending_staff_id ?? user?.id ?? null,
    visit_date:          input.visit_date,
    visit_time:          input.visit_time ?? null,
    service_type:        input.service_type ?? null,
    shift:               input.shift ?? null,
    chief_complaint:     input.chief_complaint ?? null,
    status:              input.status,
    notes:               input.notes ?? null,
    package_id:          resolvePackageId(input.service_type, input.package_id),
    kehadiran:           input.kehadiran ?? null,
    layanan_id:          input.layanan_id ?? null,
    order_id:            orderId,
    updated_at:          new Date().toISOString(),
  }).select('id').single()

  if (!error && data?.id) {
    await logActivity({
      supabase, userId: user?.id, action: 'create', resourceType: 'patient_visit',
      resourceId: data.id, resourceLabel: await decryptedPatientName(supabase, input.patient_id),
      branchId: input.branch_id, patientId: input.patient_id,
      newValues: {
        visit_date: input.visit_date, visit_time: input.visit_time ?? null,
        service_type: input.service_type ?? null, shift: input.shift ?? null,
        status: input.status, attending_staff_id: input.attending_staff_id ?? user?.id ?? null,
      },
    })
  }

  return { error: error?.message ?? null }
}

// ── Quick status update ────────────────────────────────────────────────────────
export async function updateVisitStatus(
  visitId: string,
  status: VisitStatus,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: oldRow } = await supabase
    .from('patient_visits')
    .select('status, kehadiran, patient_id, branch_id')
    .eq('id', visitId)
    .single()

  const update: { status: VisitStatus; updated_at: string; kehadiran?: string } = {
    status,
    updated_at: new Date().toISOString(),
  }
  // no_show is recorded on the visit/patient history even though the slot is
  // freed up on the daily grid — see DailyGrid, which hides no_show visits.
  if (status === 'no_show') update.kehadiran = 'TIDAK HADIR'
  // Completing without an explicit kehadiran means the patient came — record it
  // so package counts don't treat the visit as still "terjadwal".
  if (status === 'completed' && !oldRow?.kehadiran) update.kehadiran = 'HADIR'
  const { error } = await supabase
    .from('patient_visits')
    .update(update)
    .eq('id', visitId)

  if (!error && oldRow) {
    await logActivity({
      supabase, userId: user?.id, action: 'update', resourceType: 'patient_visit',
      resourceId: visitId, resourceLabel: await decryptedPatientName(supabase, oldRow.patient_id),
      branchId: oldRow.branch_id, patientId: oldRow.patient_id,
      oldValues: { status: oldRow.status, kehadiran: oldRow.kehadiran },
      newValues: { status, kehadiran: update.kehadiran ?? oldRow.kehadiran },
    })
  }

  return { error: error?.message ?? null }
}

// ── Delete visit ───────────────────────────────────────────────────────────────
export async function deleteVisit(visitId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: oldRow } = await supabase
    .from('patient_visits')
    .select('patient_id, branch_id, visit_date, service_type, status')
    .eq('id', visitId)
    .single()

  // .select() so a delete that RLS silently filtered out (zero rows, no error)
  // is reported instead of looking like success while the row stays put.
  const { data: deleted, error } = await supabase.from('patient_visits').delete().eq('id', visitId).select('id')
  if (error?.code === '23503') {
    return { error: 'Kunjungan ini sudah punya data terkait (pembayaran / catatan sesi / asesmen) — hapus data tersebut dulu.' }
  }
  if (!error && !deleted?.length) {
    return { error: 'Kunjungan tidak bisa dihapus — data tidak ditemukan atau Anda tidak memiliki akses.' }
  }

  if (!error && oldRow) {
    await logActivity({
      supabase, userId: user?.id, action: 'delete', resourceType: 'patient_visit',
      resourceId: visitId, resourceLabel: await decryptedPatientName(supabase, oldRow.patient_id),
      branchId: oldRow.branch_id, patientId: oldRow.patient_id,
      oldValues: { visit_date: oldRow.visit_date, service_type: oldRow.service_type, status: oldRow.status },
    })
  }

  return { error: error?.message ?? null }
}

// ── Fetch a single visit with decrypted patient name ──────────────────────────
export interface VisitWithPatient {
  id: string
  patient_id: string
  patient_name: string
  branch_id: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  shift: string | null
  kehadiran: string | null
  regio: string | null
  sumber_pasien: string | null
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  attending_staff_id: string | null
  status: VisitStatus
  notes: string | null
  package_id: string | null
}

export async function fetchVisitWithPatient(visitId: string): Promise<VisitWithPatient | null> {
  const supabase = await createClient()
  const { data: v, error } = await supabase
    .from('patient_visits')
    .select('id, patient_id, branch_id, visit_date, visit_time, service_type, shift, kehadiran, regio, sumber_pasien, chief_complaint, diagnosis, treatment, attending_staff_id, status, notes, package_id')
    .eq('id', visitId)
    .single()

  if (error || !v) return null

  const { data: p } = await supabase
    .from('patients')
    .select('encrypted_name, encrypted_phone')
    .eq('id', v.patient_id)
    .single()

  let patient_name = 'Pasien'
  if (p) {
    try {
      const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
      patient_name = dec.name || 'Pasien'
    } catch { /* keep default */ }
  }

  return {
    id:                 v.id,
    patient_id:         v.patient_id,
    patient_name,
    branch_id:          v.branch_id,
    visit_date:         v.visit_date,
    visit_time:         v.visit_time ? String(v.visit_time).slice(0, 5) : null,
    service_type:       v.service_type,
    shift:              v.shift,
    kehadiran:          v.kehadiran,
    regio:              v.regio,
    sumber_pasien:      v.sumber_pasien,
    chief_complaint:    v.chief_complaint,
    diagnosis:          v.diagnosis,
    treatment:          v.treatment,
    attending_staff_id: v.attending_staff_id,
    status:             v.status as VisitStatus,
    notes:              v.notes,
    package_id:         v.package_id ?? null,
  }
}

// ── Detach a visit from its package ────────────────────────────────────────────
// Reclassifies a package-linked visit as a standalone billable session — used
// when a visit was mistakenly scheduled against a package, or the patient
// chooses to pay for this one session separately instead of drawing it from
// the package. Clearing package_id also updates patient_packages_with_stats'
// remaining_sessions count for the source package (it counts by package_id).
const PACKAGE_DETACH_ROLES = ['finance', 'manager', 'director', 'admin']

export async function detachVisitFromPackage(
  visitId: string,
  serviceType: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !PACKAGE_DETACH_ROLES.includes(profile.role)) {
    return { error: 'Tidak memiliki akses untuk mengubah paket kunjungan' }
  }

  const { error } = await supabase
    .from('patient_visits')
    .update({ package_id: null, service_type: serviceType, updated_at: new Date().toISOString() })
    .eq('id', visitId)
  return { error: error?.message ?? null }
}

// ── Attach a visit to an existing package ──────────────────────────────────────
// The reverse of detachVisitFromPackage — for a visit that was booked without a
// package (or where the wrong package was picked) but should draw from one of
// the patient's existing packages instead of being billed on its own.
export async function attachVisitToPackage(
  visitId: string,
  packageId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !PACKAGE_DETACH_ROLES.includes(profile.role)) {
    return { error: 'Tidak memiliki akses untuk mengubah paket kunjungan' }
  }

  const { data: visit, error: visitErr } = await supabase
    .from('patient_visits')
    .select('patient_id, service_type')
    .eq('id', visitId)
    .single()
  if (visitErr || !visit) return { error: 'Kunjungan tidak ditemukan' }

  if (NO_PACKAGE_SERVICE_TYPES.has(visit.service_type ?? '')) {
    return { error: 'Kunjungan Terapi Awal tidak bisa menggunakan paket' }
  }

  const { data: pkg, error: pkgErr } = await supabase
    .from('patient_packages')
    .select('patient_id')
    .eq('id', packageId)
    .single()
  if (pkgErr || !pkg) return { error: 'Paket tidak ditemukan' }
  if (pkg.patient_id !== visit.patient_id) {
    return { error: 'Paket ini bukan milik pasien pada kunjungan ini' }
  }

  const { error } = await supabase
    .from('patient_visits')
    .update({ package_id: packageId, updated_at: new Date().toISOString() })
    .eq('id', visitId)
  return { error: error?.message ?? null }
}

// ── Update visit clinical fields ───────────────────────────────────────────────
export async function updateVisit(
  visitId: string,
  data: {
    visit_date?: string
    visit_time?: string | null
    attending_staff_id?: string | null
    service_type?: string | null
    shift?: string | null
    kehadiran?: string | null
    regio?: string | null
    sumber_pasien?: string | null
    chief_complaint?: string | null
    diagnosis?: string | null
    treatment?: string | null
    status?: VisitStatus
    notes?: string | null
    layanan_id?: string | null
  },
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: oldRow } = await supabase
    .from('patient_visits')
    .select('visit_date, visit_time, attending_staff_id, service_type, shift, kehadiran, regio, sumber_pasien, chief_complaint, diagnosis, treatment, status, notes, layanan_id, patient_id, branch_id')
    .eq('id', visitId)
    .single()

  const { error } = await supabase
    .from('patient_visits')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', visitId)

  if (!error && oldRow) {
    const { patient_id, branch_id, ...oldFields } = oldRow
    await logActivity({
      supabase, userId: user?.id, action: 'update', resourceType: 'patient_visit',
      resourceId: visitId, resourceLabel: await decryptedPatientName(supabase, patient_id),
      branchId: branch_id, patientId: patient_id,
      oldValues: oldFields,
      newValues: { ...oldFields, ...data },
    })
  }

  return { error: error?.message ?? null }
}

// ── Fetch active staff for a branch (therapist dropdown) ──────────────────────
export interface BranchStaffMember {
  id: string
  full_name: string
  nickname: string | null
}

export async function fetchBranchStaff(branchId: string): Promise<BranchStaffMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_profiles')
    .select('id, full_name, nickname')
    .eq('branch_id', branchId)
    .in('role', ['therapist', 'staff', 'manager'])
    .eq('is_active', true)
    .order('full_name')
  return (data ?? []) as BranchStaffMember[]
}

// ── Bulk-create visits (recurring assignment) ──────────────────────────────────
export async function createBulkVisits(
  inputs: CreateVisitInput[],
): Promise<{ error: string | null; created: number }> {
  if (inputs.length === 0) return { error: null, created: 0 }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const capacityError = await checkPackageCapacity(supabase, inputs)
  if (capacityError) return { error: capacityError, created: 0 }

  // Every scheduled session is its own jadwal/order — generate one order_id per row.
  const rows = []
  for (const input of inputs) {
    const orderId = await generateOrderId(supabase)
    rows.push({
      patient_id:          input.patient_id,
      branch_id:           input.branch_id,
      attending_staff_id:  input.attending_staff_id ?? user?.id ?? null,
      visit_date:          input.visit_date,
      visit_time:          input.visit_time ?? null,
      service_type:        input.service_type ?? null,
      shift:               input.shift ?? null,
      chief_complaint:     input.chief_complaint ?? null,
      status:              input.status,
      notes:               input.notes ?? null,
      package_id:          resolvePackageId(input.service_type, input.package_id),
      kehadiran:           input.kehadiran ?? null,
      order_id:            orderId,
      updated_at:          new Date().toISOString(),
    })
  }

  const { data, error } = await supabase.from('patient_visits').insert(rows).select('id')
  return { error: error?.message ?? null, created: data?.length ?? 0 }
}

// ── Send medical record reminder to a therapist ───────────────────────────────
const REMIND_ROLES = ['admin', 'director', 'manager', 'hr']

export async function sendMedicalRecordReminder(
  visitId: string,
): Promise<{ error: string | null; alreadySent?: boolean }> {
  const supabase = await createClient()
  const admin    = createAdminClient()

  // Auth: only REMIND_ROLES can send reminders
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !REMIND_ROLES.includes(profile.role)) return { error: 'Forbidden' }

  // Fetch the visit
  const { data: visit, error: visitErr } = await supabase
    .from('patient_visits')
    .select('id, status, diagnosis, treatment, regio, service_type, attending_staff_id, visit_date')
    .eq('id', visitId)
    .single()
  if (visitErr || !visit) return { error: 'Kunjungan tidak ditemukan' }
  if (visit.status !== 'completed') return { error: 'Kunjungan belum selesai' }
  const regioRequired = isRegioRequired(visit.service_type)
  if (visit.diagnosis && visit.treatment && (!regioRequired || visit.regio)) return { error: 'Rekam medis sudah lengkap' }
  if (!visit.attending_staff_id) return { error: 'Tidak ada terapis yang ditugaskan' }

  // Cooldown: skip if a reminder was already sent today for this visit
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: existing } = await admin
    .from('user_notifications')
    .select('id')
    .eq('user_id', visit.attending_staff_id)
    .eq('title', 'Rekam Medis Belum Diisi')
    .like('message', `%${visit.id}%`)
    .gte('created_at', todayStart.toISOString())
    .limit(1)
  if (existing && existing.length > 0) return { error: null, alreadySent: true }

  // Build message
  const dateStr = new Date(visit.visit_date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const missing: string[] = []
  if (!visit.diagnosis) missing.push('diagnosis')
  if (!visit.treatment) missing.push('tindakan')
  if (regioRequired && !visit.regio) missing.push('regio')

  await admin.from('user_notifications').insert({
    user_id: visit.attending_staff_id,
    title:   'Rekam Medis Belum Diisi',
    message: `[${visit.id}] Kunjungan ${dateStr} perlu dilengkapi: ${missing.join(', ')}`,
    link:    visit.service_type === 'SPORT MASSAGE' ? '/jadwal-sport-massage'
           : visit.service_type?.endsWith(' VISIT') ? '/home-visit'
           : '/jadwal-harian',
  })

  return { error: null }
}

// ── Send reminders for multiple incomplete visits ─────────────────────────────
export async function sendBulkMedicalRecordReminders(
  visitIds: string[],
): Promise<{ sent: number; skipped: number; error: string | null }> {
  let sent = 0
  let skipped = 0
  for (const id of visitIds) {
    const result = await sendMedicalRecordReminder(id)
    if (result.error) return { sent, skipped, error: result.error }
    if (result.alreadySent) skipped++
    else sent++
  }
  return { sent, skipped, error: null }
}
