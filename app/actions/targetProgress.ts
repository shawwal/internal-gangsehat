'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { countsAsKunjungan, KUNJUNGAN_SERVICE_FILTER, KUNJUNGAN_VISIT_STATUSES, SALE_PAYMENT_STATUSES } from '@/lib/metrics/achievement'
import { CATEGORY_TO_TRANSACTION_TYPES, EDITABLE_ROLES, TRANSACTION_CATEGORY_MAP } from '@/components/targetProgress/types'
import type { CategoryKey, TransactionForProgress } from '@/components/targetProgress/types'
import type { TransactionForEdit } from '@/components/director/finance/EditTransactionSheet'
import { deriveAdminStatus, fetchPackagePositions } from '@/lib/internal/visitInsights'
import { getVisitFormRoute } from '@/lib/visitRouting'
import { resolveTherapistNames } from '@/lib/finance/therapists'

export interface TargetProgressDetailRow {
  id: string
  patientId: string | null
  patientName: string
  noRm: string | null
  serviceType: string | null
  visitTime: string | null
  fisioName: string
  // Attending therapist (visit) / attributed therapist (transaction) — filter key.
  therapistId: string | null
  // Nickname ("panggilan") when set, else full name — used by the Excel export.
  fisioNickname?: string
  packageName?: string
  jenisPaket?: string | null
  tx?: TransactionForEdit
  // Kunjungan rows only — feeds the popup's Excel export.
  visitDate?: string
  pertemuanKe?: number
  kehadiran?: 'HADIR' | 'TIDAK HADIR' | null
  statusKunjungan?: string
}

interface VisitRow {
  id: string
  patient_id: string
  attending_staff_id: string | null
  visit_date: string
  visit_time: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  status: string | null
  service_type: string | null
  package_id: string | null
  diagnosis: string | null
  treatment: string | null
  regio: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internal_profiles: any
}

// Same wording the clinic's own visit log uses: a TERAPI AWAL is "diperiksa"
// (assessed), every follow-up session is "ditangani" (treated).
function statusKunjunganLabel(v: VisitRow, formStatus: string | undefined): string {
  const verb = getVisitFormRoute(v.service_type) === 'assessment' ? 'Diperiksa' : 'Ditangani'
  return `${deriveAdminStatus(v, formStatus) === 'LENGKAP' ? 'Sudah' : 'Belum'} ${verb}`
}

interface TransactionRow {
  id: string
  patient_id: string | null
  visit_id: string | null
  fisio_id: string | null
  category: string
  harga: number | null
  discount: number | null
  amount: number | null
  payment_method: string | null
  payment_status: string | null
  status: string
  description: string | null
  penjamin: string | null
  transaction_date: string
  receipt_url: string | null
}

// Transactions that count toward the branch's TA/Sesi/Paket progress for a date
// range. RLS only lets finance-capable roles read `transactions`, but every
// role with the Progress Target page (therapist, staff, hr, marketing) must see
// the same branch totals — so this reads with the service role after checking
// the caller belongs to that branch, and returns only category + date (no
// amounts or patient data).
export async function fetchTargetProgressTransactions(
  branchId: string,
  start: string,
  end: string,
): Promise<TransactionForProgress[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role === 'non-staff') return []
  if (profile.role !== 'director' && profile.branch_id !== branchId) return []

  const { data, error } = await createAdminClient()
    .from('transactions')
    .select('category, transaction_date')
    .eq('branch_id', branchId)
    .eq('type', 'income')
    .neq('status', 'rejected')
    .in('payment_status', [...SALE_PAYMENT_STATUSES])
    .in('category', Object.keys(TRANSACTION_CATEGORY_MAP))
    .gte('transaction_date', start)
    .lte('transaction_date', end)

  if (error || !data) return []
  return data as TransactionForProgress[]
}

// `endDate` defaults to `startDate` (a single day cell); the Capaian column
// passes the whole month.
export async function fetchTargetProgressDetail(
  branchId: string,
  startDate: string,
  category: CategoryKey,
  endDate: string = startDate,
): Promise<TargetProgressDetailRow[]> {
  const supabase = await createClient()

  if (category !== 'kunjungan') {
    // TA/Sesi/Paket Klinik/Paket Visit are counted straight from `transactions`
    // (Kategori match + Pembayaran LUNAS/DP) — the same source the summary
    // table now uses, so this list always matches the day cell exactly, and
    // the rows returned are real transactions that can be edited/deleted.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('role, branch_id')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role === 'non-staff') return []
    if (profile.role !== 'director' && profile.branch_id !== branchId) return []
    // Roles without `transactions` RLS access (therapist, hr, …) still get the
    // list, read with the service role — but without the editable tx payload
    // (amounts / payment detail), same as fetchTargetProgressTransactions.
    const canReadTx = (EDITABLE_ROLES as readonly string[]).includes(profile.role)
    const db = canReadTx ? supabase : createAdminClient()

    const txCategories = CATEGORY_TO_TRANSACTION_TYPES[category] ?? []
    const { data, error } = await db
      .from('transactions')
      .select(
        'id, patient_id, visit_id, fisio_id, category, harga, discount, amount, payment_method, ' +
        'payment_status, status, description, penjamin, transaction_date, receipt_url',
      )
      .eq('branch_id', branchId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .eq('type', 'income')
      .neq('status', 'rejected')
      .in('payment_status', [...SALE_PAYMENT_STATUSES])
      .in('category', txCategories)

    if (error || !data) return []
    const rows = (data as unknown as TransactionRow[])
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))

    const patientIds = [...new Set(rows.map((row) => row.patient_id).filter((id): id is string => !!id))]
    const [{ data: patients }, therapists] = await Promise.all([
      db.from('patients').select('id, encrypted_name, no_rm').in('id', patientIds),
      // fisio_id, else the linked visit's attending staff — same rule as the finance pages.
      resolveTherapistNames(supabase, rows),
    ])
    const patientById = new Map((patients ?? []).map((p) => [p.id as string, p]))

    return rows.map((row) => {
      const patient = row.patient_id ? patientById.get(row.patient_id) : undefined
      const name = patient?.encrypted_name
        ? decryptPatientPII({ encrypted_name: patient.encrypted_name, encrypted_phone: '' }).name
        : '—'
      const therapist = therapists.get(row.id)
      return {
        id: row.id,
        patientId: row.patient_id,
        patientName: name || '—',
        noRm: (patient?.no_rm as string | null) ?? null,
        serviceType: row.category,
        visitTime: null,
        fisioName: therapist?.name ?? '—',
        therapistId: therapist?.id ?? null,
        visitDate: row.transaction_date,
        tx: canReadTx ? {
          id: row.id,
          type: 'income',
          category: row.category,
          harga: row.harga,
          discount: row.discount,
          amount: row.amount,
          payment_method: row.payment_method,
          payment_status: row.payment_status,
          penjamin: row.penjamin,
          description: row.description,
          receipt_url: row.receipt_url,
          transaction_date: row.transaction_date,
          patient_id: row.patient_id,
          patient_name: name || '—',
        } : undefined,
      }
    })
  }

  // Kunjungan comes from attendance alone (isAttended), unconditionally — no
  // payment gating, matching exactly how the summary table computes it.
  const { data, error } = await supabase
    .from('patient_visits')
    .select(
      'id, patient_id, attending_staff_id, visit_date, visit_time, kehadiran, status, service_type, package_id, ' +
      'diagnosis, treatment, regio, internal_profiles!attending_staff_id(full_name, nickname)',
    )
    .eq('branch_id', branchId)
    .gte('visit_date', startDate)
    .lte('visit_date', endDate)
    .in('status', [...KUNJUNGAN_VISIT_STATUSES])
    // Sport massage is tracked separately — not a "kunjungan" (matches target-progress page)
    .or(KUNJUNGAN_SERVICE_FILTER)

  if (error || !data) return []

  const allVisits = data as unknown as VisitRow[]
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const rows = allVisits.filter((v) => countsAsKunjungan(v, today))
  rows.sort((a, b) =>
    a.visit_date.localeCompare(b.visit_date) || (a.visit_time ?? '').localeCompare(b.visit_time ?? ''))

  // patient_visits has no FK relationship registered for `patient_id` in the
  // PostgREST schema cache, so `patients!patient_id(...)` embedding silently
  // returns 0 rows — fetch patients separately instead (two-step, per CLAUDE.md).
  const patientIds = [...new Set(rows.map((row) => row.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name, no_rm')
    .in('id', patientIds)
  const patientById = new Map((patients ?? []).map((p) => [p.id as string, p]))

  // Layanan / pertemuan ke / status kunjungan — derived the same way as the
  // Jadwal List page (app/actions/jadwalList.ts) so both views agree.
  const visitIds = rows.map((row) => row.id)
  const packageIds = [...new Set(rows.map((row) => row.package_id).filter((id): id is string => !!id))]
  const [packagePositions, packages, assessments, sessionNotes, griyaIntakes, griyaNotes] = await Promise.all([
    fetchPackagePositions(supabase, packageIds),
    packageIds.length > 0
      ? supabase.from('patient_packages_with_stats').select('id, jenis_paket').in('id', packageIds)
      : Promise.resolve({ data: [] as { id: string; jenis_paket: string | null }[] }),
    supabase.from('terapi_awal_assessments').select('visit_id, status').in('visit_id', visitIds),
    supabase.from('session_notes').select('visit_id, status').in('visit_id', visitIds),
    supabase.from('griya_terapi_awal').select('visit_id, status').in('visit_id', visitIds),
    supabase.from('griya_session_notes').select('visit_id, status').in('visit_id', visitIds),
  ])

  const jenisPaketById = new Map((packages.data ?? []).map((p) => [p.id as string, p.jenis_paket as string | null]))

  // Record-form status per visit; 'completed' wins if a visit has more than one row.
  const formStatusMap = new Map<string, string>()
  for (const r of [
    ...(assessments.data ?? []), ...(sessionNotes.data ?? []),
    ...(griyaIntakes.data ?? []), ...(griyaNotes.data ?? []),
  ]) {
    const vid = r.visit_id as string
    if (formStatusMap.get(vid) !== 'completed') formStatusMap.set(vid, r.status as string)
  }

  return rows.map((row) => {
    // P1/P2 → "PAKET 1"/"PAKET 2"; a package with no jenis is just "PAKET".
    const jenisPaket = row.package_id ? jenisPaketById.get(row.package_id) ?? null : null
    const layanan = row.package_id
      ? `PAKET ${jenisPaket?.replace(/^P/, '') ?? ''}`.trim()
      : row.service_type
    const patient = patientById.get(row.patient_id)
    const name = patient?.encrypted_name
      ? decryptPatientPII({ encrypted_name: patient.encrypted_name, encrypted_phone: '' }).name
      : '—'
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: name || '—',
      noRm: (patient?.no_rm as string | null) ?? null,
      serviceType: layanan,
      visitTime: row.visit_time,
      fisioName: row.internal_profiles?.full_name ?? '—',
      therapistId: row.attending_staff_id,
      fisioNickname: row.internal_profiles?.nickname?.trim() || row.internal_profiles?.full_name || '—',
      visitDate: row.visit_date,
      pertemuanKe: row.package_id ? (packagePositions.get(row.id)?.pertemuan ?? 1) : 1,
      kehadiran: row.kehadiran,
      statusKunjungan: statusKunjunganLabel(row, formStatusMap.get(row.id)),
    }
  })
}
