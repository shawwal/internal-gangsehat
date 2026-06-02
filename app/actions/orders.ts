'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'

export type BookingSession = {
  id: string
  booking_id: string
  session_number: number
  tanggal: string | null
  jam: string | null
  therapist_id: string | null
  kehadiran: string | null
  status: string
  nominal_bayar: number
  metode_pembayaran: string | null
  keterangan: string | null
  catatan_admin: string | null
  wa_order_count: number
  wa_reminder_count: number
  created_at: string
  updated_at: string
  therapists?: { id: string; profiles: { full_name: string } | null } | null
}

export type BookingPayment = {
  id: string
  booking_id: string
  tanggal: string
  nominal: number
  waktu_bayar: string | null
  metode: string | null
  catatan: string | null
  created_at: string
}

export type OrderDetail = {
  id: string
  service_type: string
  status: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  city: string | null
  estimated_price: number | null
  discounted_price: number | null
  discount_percentage: number | null
  distance_fee: number
  payment_method: string | null
  patient_notes: string | null
  therapist_notes: string | null
  admin_notes: string | null
  rating: number | null
  feedback: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  guest_age: number | null
  guest_gender: string | null
  is_for_other: boolean
  parent_name: string | null
  parent_job: string | null
  confirmed_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string | null
  // joined relations
  patients: { encrypted_name: string; encrypted_phone: string; encrypted_birth_date: string | null; gender: string | null } | null
  therapists: { id: string; profiles: { full_name: string } | null } | null
  internal_order_meta: { id: string; kode_transaksi: string; status_bayar: string; catatan_admin: string | null }[] | null
  booking_sessions: BookingSession[]
  booking_payments: BookingPayment[]
  // decrypted patient fields
  _patientName: string
  _patientPhone: string
  _patientBirthDate: string | null
  _patientGender: string | null
}

export async function fetchOrderDetail(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      patients ( encrypted_name, encrypted_phone, encrypted_birth_date, gender ),
      therapists ( id, profiles ( full_name ) ),
      internal_order_meta ( id, kode_transaksi, status_bayar, catatan_admin ),
      booking_sessions ( *, therapists ( id, profiles ( full_name ) ) ),
      booking_payments ( * )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  // Decrypt patient PII
  let patientName = data.guest_name ?? '—'
  let patientPhone = data.guest_phone ?? ''
  let patientBirthDate: string | null = null
  let patientGender: string | null = null

  if (data.patients) {
    try {
      const pii = decryptPatientPII({
        encrypted_name: data.patients.encrypted_name ?? '',
        encrypted_phone: data.patients.encrypted_phone ?? '',
        encrypted_birth_date: data.patients.encrypted_birth_date ?? undefined,
      })
      if (pii.name) patientName = pii.name
      if (pii.phone) patientPhone = pii.phone
      patientBirthDate = pii.birthDate ?? null
    } catch {
      // decryption failed — show raw value as fallback
    }
    patientGender = data.patients.gender
  }

  // Sort sessions by session_number
  const sessions = ((data.booking_sessions ?? []) as BookingSession[])
    .sort((a, b) => a.session_number - b.session_number)

  // Sort payments by created_at ascending
  const payments = ((data.booking_payments ?? []) as BookingPayment[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  return {
    ...(data as unknown as OrderDetail),
    booking_sessions: sessions,
    booking_payments: payments,
    _patientName: patientName,
    _patientPhone: patientPhone,
    _patientBirthDate: patientBirthDate,
    _patientGender: patientGender,
  }
}

export type TherapistOption = { id: string; name: string }

export async function fetchTherapistOptions(): Promise<TherapistOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('therapists')
    .select('id, profiles ( full_name )')
    .eq('is_available', true)
    .order('id')

  return ((data ?? []) as { id: string; profiles: { full_name: string } | null }[]).map((t) => ({
    id: t.id,
    name: t.profiles?.full_name ?? '—',
  }))
}
