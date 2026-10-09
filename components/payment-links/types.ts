import type { PaymentLinkMethod } from '@/lib/doku/channels'

export type PaymentLinkStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled'

/** Client-safe view of a payment_links row (no raw DOKU payloads). */
export interface PaymentLinkView {
  id: string
  created_at: string
  branch_id: string
  branch_name: string | null
  patient_id: string | null
  visit_id: string | null
  order_id: string | null
  transaction_id: string | null
  method: PaymentLinkMethod
  amount: number
  category: string
  description: string | null
  customer_name: string
  customer_phone: string | null
  invoice_number: string
  checkout_url: string | null
  environment: 'development' | 'production'
  status: PaymentLinkStatus
  expires_at: string
  sent_at: string | null
  sent_via: 'whatsapp' | 'copy' | 'screen' | null
  paid_at: string | null
  payment_channel: string | null
  doku_reference: string | null
  has_receipt: boolean
  created_by_name: string | null
}

export interface PaymentLinkFilters {
  status?: PaymentLinkStatus | ''
  method?: PaymentLinkMethod | ''
  branchId?: string
  patientId?: string
  visitId?: string
  search?: string
}

/** What a host page knows when it opens the create dialog. */
export interface PaymentLinkTarget {
  patientId?: string | null
  patientName?: string | null
  visitId?: string | null
  orderId?: string | null
  amount?: number | null
  harga?: number | null
  discount?: number | null
  category?: string | null
  description?: string | null
  /** Preselected QRIS / VA (e.g. chosen on the host form's Metode Bayar). */
  method?: 'QRIS' | 'VA' | null
  /** Preselected branch (director forms). */
  branchId?: string | null
}

/** A pending link past its expiry shows as expired before the next sync flips it. */
export function effectiveStatus(link: Pick<PaymentLinkView, 'status' | 'expires_at'>): PaymentLinkStatus {
  if (link.status === 'pending' && Date.parse(link.expires_at) < Date.now()) return 'expired'
  return link.status
}
