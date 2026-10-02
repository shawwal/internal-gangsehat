'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { VISIT_STATUS_FILTER, isAttended } from '@/components/performance/utils'
import { CATEGORY_TO_TRANSACTION_TYPES, TRANSACTION_CATEGORY_MAP } from '@/components/targetProgress/types'
import type { CategoryKey, TransactionForProgress } from '@/components/targetProgress/types'
import type { TransactionForEdit } from '@/components/director/finance/EditTransactionSheet'
import { deriveAdminStatus, fetchPackagePositions } from '@/lib/internal/visitInsights'
import { getVisitFormRoute } from '@/lib/visitRouting'

export interface TargetProgressDetailRow {
  id: string
  patientName: string
  serviceType: string | null
  visitTime: string | null
  fisioName: string
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
  visit_date: string
  visit_time: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
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
    .in('payment_status', ['LUNAS', 'DP'])
    .in('category', Object.keys(TRANSACTION_CATEGORY_MAP))
    .gte('transaction_date', start)
    .lte('transaction_date', end)

  if (error || !data) return []
  return data as TransactionForProgress[]
}

export async function fetchTargetProgressDetail(
  branchId: string,
  visitDate: string,
  category: CategoryKey,
): Promise<TargetProgressDetailRow[]> {
  const supabase = await createClient()

  if (category !== 'kunjungan') {
    // TA/Sesi/Paket Klinik/Paket Visit are counted straight from `transactions`
    // (Kategori match + Pembayaran LUNAS/DP) — the same source the summary
    // table now uses, so this list always matches the day cell exactly, and
    // the rows returned are real transactions that can be edited/deleted.
    const txCategories = CATEGORY_TO_TRANSACTION_TYPES[category] ?? []
    const { data, error } = await supabase
      .from('transactions')
      .select(
        'id, patient_id, category, harga, discount, amount, payment_method, ' +
        'payment_status, status, description, penjamin, transaction_date',
      )
      .eq('branch_id', branchId)
      .eq('transaction_date', visitDate)
      .eq('type', 'income')
      .neq('status', 'rejected')
      .in('payment_status', ['LUNAS', 'DP'])
      .in('category', txCategories)

    if (error || !data) return []
    const rows = data as unknown as TransactionRow[]

    const patientIds = [...new Set(rows.map((row) => row.patient_id).filter((id): id is string => !!id))]
    const { data: patients } = await supabase
      .from('patients')
      .select('id, encrypted_name')
      .in('id', patientIds)
    const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

    return rows.map((row) => {
      const encName = row.patient_id ? nameById.get(row.patient_id) ?? '' : ''
      const name = encName
        ? decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name
        : '—'
      return {
        id: row.id,
        patientName: name || '—',
        serviceType: row.category,
        visitTime: null,
        fisioName: '—',
        tx: {
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
          transaction_date: row.transaction_date,
          patient_id: row.patient_id,
          patient_name: name || '—',
        },
      }
    })
  }

  // Kunjungan comes from attendance alone (isAttended), unconditionally — no
  // payment gating, matching exactly how the summary table computes it.
  const { data, error } = await supabase
    .from('patient_visits')
    .select(
      'id, patient_id, visit_date, visit_time, kehadiran, service_type, package_id, ' +
      'diagnosis, treatment, regio, internal_profiles!attending_staff_id(full_name)',
    )
    .eq('branch_id', branchId)
    .eq('visit_date', visitDate)
    .in('status', [...VISIT_STATUS_FILTER])
    // Sport massage is tracked separately — not a "kunjungan" (matches target-progress page)
    .or('service_type.is.null,service_type.neq."SPORT MASSAGE"')

  if (error || !data) return []

  const allVisits = data as unknown as VisitRow[]
  const rows = allVisits.filter((v) => isAttended(v))
  rows.sort((a, b) => (a.visit_time ?? '').localeCompare(b.visit_time ?? ''))

  // patient_visits has no FK relationship registered for `patient_id` in the
  // PostgREST schema cache, so `patients!patient_id(...)` embedding silently
  // returns 0 rows — fetch patients separately instead (two-step, per CLAUDE.md).
  const patientIds = [...new Set(rows.map((row) => row.patient_id))]
  const { data: patients } = await supabase
    .from('patients')
    .select('id, encrypted_name')
    .in('id', patientIds)
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

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
    const encName = nameById.get(row.patient_id) ?? ''
    const name = encName
      ? decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name
      : '—'
    return {
      id: row.id,
      patientName: name || '—',
      serviceType: layanan,
      visitTime: row.visit_time,
      fisioName: row.internal_profiles?.full_name ?? '—',
      visitDate: row.visit_date,
      pertemuanKe: row.package_id ? (packagePositions.get(row.id)?.pertemuan ?? 1) : 1,
      kehadiran: row.kehadiran,
      statusKunjungan: statusKunjunganLabel(row, formStatusMap.get(row.id)),
    }
  })
}
