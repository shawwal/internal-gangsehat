// Server-side loaders for the achievement rule (lib/metrics/achievement.ts):
// record-form status per visit and purchase-aware sale validity. Callers pass a
// client that can read the rows (usually the service role, after their own
// access check).

import type { createClient } from '@/lib/supabase/server'
import { deriveAdminStatus } from '@/lib/internal/visitInsights'
import { resolveTherapistIds } from '@/lib/finance/therapists'
import { groupPurchases, saleIssues, type Purchase, type SaleTx } from './achievement'

type Db = { from: Awaited<ReturnType<typeof createClient>>['from'] }

const CHUNK = 300

/** Record forms that mark a visit "Sudah Ditangani / Diperiksa". */
const FORM_TABLES = ['terapi_awal_assessments', 'session_notes', 'griya_terapi_awal', 'griya_session_notes'] as const

export interface VisitRecordFields {
  id: string
  diagnosis?: string | null
  treatment?: string | null
  regio?: string | null
  service_type: string | null
}

/** Record-form status per visit id; 'completed' wins when a visit has several rows. */
export async function fetchFormStatuses(db: Db, visitIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < visitIds.length; i += CHUNK) {
    const ids = visitIds.slice(i, i + CHUNK)
    const results = await Promise.all(FORM_TABLES.map((t) => db.from(t).select('visit_id, status').in('visit_id', ids)))
    for (const { data } of results) {
      for (const r of (data ?? []) as { visit_id: string; status: string }[]) {
        if (out.get(r.visit_id) !== 'completed') out.set(r.visit_id, r.status)
      }
    }
  }
  return out
}

/** Adds `record_complete` (Sudah Ditangani / Diperiksa) to each visit. */
export async function withRecordStatus<V extends VisitRecordFields>(db: Db, visits: V[]): Promise<(V & { record_complete: boolean })[]> {
  const forms = await fetchFormStatuses(db, visits.map((v) => v.id))
  return visits.map((v) => ({ ...v, record_complete: deriveAdminStatus({ diagnosis: v.diagnosis ?? null, treatment: v.treatment ?? null, regio: v.regio ?? null, service_type: v.service_type }, forms.get(v.id)) === 'LENGKAP' }))
}

/** Columns a transaction row needs for `evaluateSales`. */
export const SALE_TX_COLUMNS =
  'id, order_id, visit_id, fisio_id, category, payment_status, payment_method, patient_id, receipt_url, harga, discount, amount, transaction_date'

export interface SaleTxRow {
  id: string
  order_id: string | null
  visit_id: string | null
  fisio_id: string | null
  category: string
  payment_status: string | null
  payment_method?: string | null
  patient_id: string | null
  receipt_url: string | null
  harga: number | null
  discount: number | null
  amount: number | null
  transaction_date: string
}

export interface EvaluatedSale {
  tx: SaleTx & { payment_method: string | null; visit_id: string | null }
  purchase: Purchase
  issues: string[]
}

/**
 * Attributes each row to its therapist (fisio_id → linked visit) and judges it
 * against its whole purchase — the other payments of the same order are read
 * here, whatever their date.
 */
export async function evaluateSales(db: Db, rows: SaleTxRow[]): Promise<{
  sales: EvaluatedSale[]
  /** every row of the purchases involved, attributed — for payroll's "completed payment" date */
  purchases: Map<string, Purchase>
}> {
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((x): x is string => !!x))]
  const extra: SaleTxRow[] = []
  for (let i = 0; i < orderIds.length; i += CHUNK) {
    const { data } = await db.from('transactions').select(SALE_TX_COLUMNS)
      .in('order_id', orderIds.slice(i, i + CHUNK))
      .eq('type', 'income')
      .neq('status', 'rejected')
    extra.push(...((data ?? []) as unknown as SaleTxRow[]))
  }
  const seen = new Set(rows.map((r) => r.id))
  const all = [...rows, ...extra.filter((r) => !seen.has(r.id) && (seen.add(r.id), true))]

  const staffByTx = await resolveTherapistIds(db, all)
  const toSale = (r: SaleTxRow) => ({
    id: r.id, order_id: r.order_id, category: r.category, payment_status: r.payment_status,
    patient_id: r.patient_id, staff_id: staffByTx.get(r.id) ?? null, receipt_url: r.receipt_url,
    harga: r.harga, discount: r.discount, amount: r.amount, transaction_date: r.transaction_date,
    payment_method: r.payment_method ?? null, visit_id: r.visit_id,
  })
  const purchases = groupPurchases(all.map(toSale))
  const sales = rows.map((r) => {
    const tx = toSale(r)
    const purchase = purchases.get(r.id)!
    return { tx, purchase, issues: saleIssues(tx, purchase) }
  })
  return { sales, purchases }
}
