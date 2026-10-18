import type { SupabaseClient } from '@supabase/supabase-js'
import { generateOrderId } from '@/lib/internal/orderId'
import { decryptPatientPII } from '@/lib/encryption'

// Turns an online_bookings hold into a Jadwal Harian visit (patient_visits).
// Used right away for package bookings (lib/onlineBooking/service.ts) and on
// DOKU settlement for paid bookings (lib/doku/settle.ts). Kept free of settle
// imports to avoid a cycle.

export interface OnlineBookingRow {
  id: string
  patient_id: string
  branch_id: string
  staff_id: string
  visit_date: string
  visit_hour: number
  shift: string | null
  mode: 'package' | 'pay'
  package_id: string | null
  layanan_id: string | null
  service_type: string
  status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled'
  visit_id: string | null
}

export const ONLINE_BOOKING_COLS =
  'id, patient_id, branch_id, staff_id, visit_date, visit_hour, shift, mode, package_id, layanan_id, service_type, status, visit_id'

const pad = (n: number) => String(n).padStart(2, '0')

/** Insert the patient_visits row for a (claimed) booking and attach it. */
export async function insertOnlineVisit(admin: SupabaseClient, booking: OnlineBookingRow): Promise<string> {
  const orderId = await generateOrderId(admin)
  const { data, error } = await admin.from('patient_visits').insert({
    patient_id:         booking.patient_id,
    branch_id:          booking.branch_id,
    attending_staff_id: booking.staff_id,
    visit_date:         booking.visit_date,
    visit_time:         `${pad(booking.visit_hour)}:00`,
    shift:              booking.shift,
    service_type:       booking.service_type,
    package_id:         booking.mode === 'package' ? booking.package_id : null,
    layanan_id:         booking.layanan_id,
    status:             'scheduled',
    booking_source:     'online',
    notes:              'Booking online gangsehat.com',
    order_id:           orderId,
    updated_at:         new Date().toISOString(),
  }).select('id').single()
  if (error || !data) throw new Error(error?.message ?? 'Gagal membuat kunjungan')

  await admin.from('online_bookings')
    .update({ visit_id: data.id, status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', booking.id)

  await notifyOnlineBooking(admin, booking)
  return data.id
}

/**
 * Paid DOKU link → visit. Race-safe: only the caller that flips the hold to
 * 'confirmed' inserts the visit; others get the existing visit_id (or null
 * while the winner is still inserting — the next sync picks it up). A hold
 * that expired but still got paid is confirmed too; staff resolve any clash.
 */
export async function confirmPaidOnlineBooking(admin: SupabaseClient, bookingId: string): Promise<string | null> {
  const { data: claimed } = await admin
    .from('online_bookings')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .in('status', ['pending_payment', 'expired'])
    .select(ONLINE_BOOKING_COLS)
    .maybeSingle()

  if (!claimed) {
    const { data: existing } = await admin.from('online_bookings').select('visit_id').eq('id', bookingId).maybeSingle()
    return existing?.visit_id ?? null
  }
  try {
    return await insertOnlineVisit(admin, claimed as OnlineBookingRow)
  } catch (error) {
    // Put the claim back so the next sync retries the insert.
    console.error('online booking: visit insert failed', { bookingId, error })
    await admin.from('online_bookings').update({ status: 'pending_payment' }).eq('id', bookingId).is('visit_id', null)
    return null
  }
}

async function notifyOnlineBooking(admin: SupabaseClient, booking: OnlineBookingRow) {
  const { data: p } = await admin.from('patients').select('encrypted_name').eq('id', booking.patient_id).maybeSingle()
  const name = p ? decryptPatientPII({ encrypted_name: p.encrypted_name, encrypted_phone: '' }).name : 'Pasien'
  const when = `${booking.visit_date} ${pad(booking.visit_hour)}:00`
  const base = {
    title: 'Booking Online Baru',
    message: `${name} · ${booking.service_type} · ${when}${booking.mode === 'package' ? ' · paket' : ' · lunas DOKU'}`,
    link: '/jadwal-harian',
  }
  const { data: reviewers } = await admin
    .from('internal_profiles')
    .select('id, role, branch_id')
    .eq('is_active', true)
    .in('role', ['director', 'manager', 'admin'])
  const rows = (reviewers ?? [])
    .filter((r) => r.role === 'director' || r.branch_id === booking.branch_id)
    .map((r) => ({ ...base, user_id: r.id }))
  rows.push({ ...base, user_id: booking.staff_id })
  const { error } = await admin.from('user_notifications').insert(rows)
  if (error) console.error('online booking: notification failed', error)
}
