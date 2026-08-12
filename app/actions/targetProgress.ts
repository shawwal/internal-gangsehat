'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { VISIT_STATUS_FILTER, isAttended } from '@/components/performance/utils'
import { CATEGORY_TO_TRANSACTION_TYPES } from '@/components/targetProgress/types'
import type { CategoryKey } from '@/components/targetProgress/types'
import type { TransactionForEdit } from '@/components/director/finance/EditTransactionSheet'

export interface TargetProgressDetailRow {
  id: string
  patientName: string
  serviceType: string | null
  visitTime: string | null
  fisioName: string
  packageName?: string
  jenisPaket?: string | null
  tx?: TransactionForEdit
}

interface VisitRow {
  id: string
  patient_id: string
  visit_date: string
  visit_time: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internal_profiles: any
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
      'id, patient_id, visit_date, visit_time, kehadiran, ' +
      'internal_profiles!attending_staff_id(full_name)',
    )
    .eq('branch_id', branchId)
    .eq('visit_date', visitDate)
    .in('status', [...VISIT_STATUS_FILTER])

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

  return rows.map((row) => {
    const encName = nameById.get(row.patient_id) ?? ''
    const name = encName
      ? decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name
      : '—'
    return {
      id: row.id,
      patientName: name || '—',
      serviceType: null,
      visitTime: row.visit_time,
      fisioName: row.internal_profiles?.full_name ?? '—',
    }
  })
}
