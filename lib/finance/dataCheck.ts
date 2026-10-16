// "Cek Data" rules — which transactions / visits are missing details. Pure:
// the server action queries, this module decides. One place, so the page's
// counts, its lists and its bulk fix always agree.

import { deriveAdminStatus } from '@/lib/internal/visitInsights'
import { visitAttended } from '@/lib/metrics/achievement'
import { requiresPaymentProof } from '@/lib/paymentProof'

/**
 * Income that must carry a Fisio (and a patient): everything except the shop.
 * TOKO sales are retail, not a therapist's sale. Expenses never need one —
 * callers only apply this to income.
 */
export const NON_THERAPIST_INCOME = ['TOKO'] as const

export const isTherapistCategory = (category: string | null | undefined) =>
  !(NON_THERAPIST_INCOME as readonly string[]).includes(category || 'LAINNYA')

export const TX_ISSUES = {
  tanpa_fisio: 'Tanpa Fisio',
  tanpa_pasien: 'Tanpa pasien',
  tanpa_status_bayar: 'Tanpa status bayar',
  tanpa_bukti: 'Transfer tanpa bukti',
} as const
export type TxIssue = keyof typeof TX_ISSUES

export const VISIT_ISSUES = {
  tanpa_fisio: 'Tanpa Fisio',
  kehadiran_kosong: 'Kehadiran belum diisi',
  rekam_medis_belum: 'Rekam medis belum lengkap',
} as const
export type VisitIssue = keyof typeof VISIT_ISSUES

export interface TxForCheck {
  category: string
  patient_id: string | null
  payment_status: string | null
  payment_method: string | null
  receipt_url: string | null
  /** resolved with the finance rule (fisio_id → linked visit's therapist) */
  therapist_id: string | null
}

export function txIssues(t: TxForCheck): TxIssue[] {
  const out: TxIssue[] = []
  const service = isTherapistCategory(t.category)
  if (service && !t.therapist_id) out.push('tanpa_fisio')
  if (service && !t.patient_id) out.push('tanpa_pasien')
  if (service && !t.payment_status) out.push('tanpa_status_bayar')
  if (requiresPaymentProof(t.payment_method) && !t.receipt_url) out.push('tanpa_bukti')
  return out
}

export interface VisitForCheck {
  visit_date: string
  attending_staff_id: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  service_type: string | null
  diagnosis: string | null
  treatment: string | null
  regio: string | null
}

/** `formStatus` = status of the visit's record form, when one exists (see targetProgress). */
export function visitIssues(v: VisitForCheck, formStatus: string | undefined, todayISO: string): VisitIssue[] {
  const out: VisitIssue[] = []
  if (!v.attending_staff_id) out.push('tanpa_fisio')
  if (v.kehadiran == null && v.visit_date < todayISO) out.push('kehadiran_kosong')
  if (visitAttended(v, todayISO) && deriveAdminStatus(v, formStatus) !== 'LENGKAP') out.push('rekam_medis_belum')
  return out
}
