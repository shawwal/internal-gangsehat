import type { LayananRow } from '@/app/actions/layanan'
import type { PatientPlain } from '@/app/actions/patients'
import type { TherapistOption } from '@/app/actions/orders'

export type LayananOption = LayananRow

export interface SessionRow {
  key: string
  session_number: number
  tanggal: string
  jam: string
  therapist_id: string
}

export interface DiscountPreset {
  label: string
  pct: number | null // null = "Custom" — reveal a free-form % input
}

export interface CreateOrderForm {
  branchId: string | null
  patient: PatientPlain | null
  layananId: string
  harga: string
  discountPresetLabel: string
  customDiscountPct: string
  dpAmount: string
  dpMetode: string
  adminNotes: string
  startDate: string
  sessionCount: string
  sessions: SessionRow[]
}

export interface CreateOrderFormErrors {
  patient?: string
  layanan?: string
  harga?: string
  discount?: string
  dp?: string
  sessions?: string
}

export type { PatientPlain, TherapistOption }
