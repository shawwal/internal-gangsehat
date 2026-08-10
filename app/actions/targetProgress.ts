'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { VISIT_STATUS_FILTER, isAttended } from '@/components/performance/utils'
import { fetchConfirmedVisitIds, fetchPaidPackageIds } from '@/lib/internal/paymentGating'
import type { CategoryKey } from '@/components/targetProgress/types'

const TA_TYPES = ['TERAPI AWAL', 'TA VISIT']
const SESI_TYPES = ['SESI TERAPI', 'SESI VISIT']

export interface TargetProgressDetailRow {
  id: string
  patientName: string
  serviceType: string | null
  visitTime: string | null
  fisioName: string
  packageName?: string
  jenisPaket?: string | null
}

interface VisitRow {
  id: string
  patient_id: string
  visit_date: string
  visit_time: string | null
  service_type: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  package_id: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internal_profiles: any
}

interface PackageRow {
  id: string
  patient_id: string
  purchased_at: string
  package_name: string
  jenis_paket: string | null
  order_id: string | null
}

export async function fetchTargetProgressDetail(
  branchId: string,
  visitDate: string,
  category: CategoryKey,
): Promise<TargetProgressDetailRow[]> {
  const supabase = await createClient()

  if (category === 'paket_klinik' || category === 'paket_visit') {
    // Paket Klinik/Visit are counted from patient_packages (the purchase/order
    // event itself), not from patient_visits sessions.
    const pkgCategory = category === 'paket_klinik' ? 'PAKET KLINIK' : 'PAKET VISIT'
    const { data, error } = await supabase
      .from('patient_packages')
      .select('id, patient_id, purchased_at, package_name, jenis_paket, order_id')
      .eq('branch_id', branchId)
      .eq('category', pkgCategory)
      .eq('purchased_at', visitDate)
      .neq('status', 'cancelled')

    if (error || !data) return []
    const allRows = data as PackageRow[]

    // Kehadiran ≠ Pembayaran: only paid packages count toward Paket progress,
    // matching the gate applied in target-progress's summary tiles.
    const paidPackageIds = await fetchPaidPackageIds(supabase, allRows, new Set(), new Map())
    const rows = allRows.filter((row) => paidPackageIds.has(row.id))

    const patientIds = [...new Set(rows.map((row) => row.patient_id))]
    const { data: patients } = await supabase
      .from('patients')
      .select('id, encrypted_name')
      .in('id', patientIds)
    const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

    return rows.map((row) => {
      const encName = nameById.get(row.patient_id) ?? ''
      const name = encName
        ? decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name
        : '—'
      return {
        id: row.id,
        patientName: name || '—',
        serviceType: null,
        visitTime: null,
        fisioName: '—',
        packageName: row.package_name,
        jenisPaket: row.jenis_paket,
      }
    })
  }

  let query = supabase
    .from('patient_visits')
    .select(
      'id, patient_id, visit_date, visit_time, service_type, kehadiran, package_id, ' +
      'internal_profiles!attending_staff_id(full_name)',
    )
    .eq('branch_id', branchId)
    .eq('visit_date', visitDate)
    .in('status', [...VISIT_STATUS_FILTER])

  if (category === 'ta') query = query.in('service_type', TA_TYPES)
  else if (category === 'sesi') query = query.in('service_type', SESI_TYPES)

  const { data, error } = await query
  if (error || !data) return []

  const allVisits = data as unknown as VisitRow[]
  // Kehadiran ≠ Pembayaran: TA/Sesi only count visits with a confirmed payment.
  const paidVisitIds = await fetchConfirmedVisitIds(supabase, allVisits.map((v) => v.id))

  // Sesi excludes visits that are sessions used from an existing package
  // (package_id set) — those are "Paket" on jadwal-harian, not a standalone Sesi sale.
  const rows = allVisits.filter((v) => {
    if (!paidVisitIds.has(v.id)) return false
    if (category === 'ta') return true
    if (!isAttended(v)) return false
    if (category === 'sesi' && v.package_id) return false
    return true
  })

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

  return rows.map((row) => {
    const encName = nameById.get(row.patient_id) ?? ''
    const name = encName
      ? decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name
      : '—'
    return {
      id: row.id,
      patientName: name || '—',
      serviceType: row.service_type,
      visitTime: row.visit_time,
      fisioName: row.internal_profiles?.full_name ?? '—',
    }
  })
}
