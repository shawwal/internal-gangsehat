import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'
import { dokuEnabled, gatewayMode } from '@/lib/doku/client'
import { newInvoiceNumber } from '@/lib/doku/invoice'
import { insertPaymentLinkWithCheckout } from '@/lib/doku/createLink'
import { findLink, syncPaymentLink } from '@/lib/doku/settle'
import { SERVICE_TO_CATEGORY } from '@/lib/serviceType'
import { toHariIndonesia } from '@/components/jadwal/utils'
import { getWeekGroupForDate } from '@/lib/schedule/weekGroup'
import { buildScheduledStaff } from '@/lib/jadwal/dayStaff'
import type { ServiceType } from '@/types'
import { computeAvailability, type AvailableHour, type BusyRow } from './availability'
import { insertOnlineVisit, ONLINE_BOOKING_COLS, type OnlineBookingRow } from './confirm'

// Online clinic booking for gangsehat.com patients (supabase/110-online-booking.sql).
// Called only from the signed /api/public/booking/* routes, with the service
// client. gangsehat resolves patientId/profileId from its own session; every
// call re-checks that the patient belongs to that profile and is linked.

type Admin = ReturnType<typeof createAdminClient>

/** How long an unpaid slot is held (also the DOKU payment window). */
export const PAY_HOLD_MINUTES = 60
/** How far ahead patients can book. */
export const MAX_DAYS_AHEAD = 30

export class BookingError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function assertBookableDate(date: string) {
  if (!DATE_RE.test(date)) throw new BookingError('invalid_date', 'Tanggal tidak valid.')
  const today = jakartaToday()
  const max = new Date(`${today}T00:00:00Z`)
  max.setUTCDate(max.getUTCDate() + MAX_DAYS_AHEAD)
  if (date < today || date > max.toISOString().slice(0, 10)) {
    throw new BookingError('invalid_date', `Tanggal harus dalam ${MAX_DAYS_AHEAD} hari ke depan.`)
  }
}

/** Calendar date at local noon, so weekday helpers don't depend on server TZ. */
function dateAtNoon(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

async function loadLinkedPatient(admin: Admin, patientId: string, profileId: string) {
  const { data: p } = await admin
    .from('patients')
    .select('id, profile_id, account_linked_at, encrypted_name, encrypted_phone, is_active')
    .eq('id', patientId)
    .maybeSingle()
  if (!p || p.profile_id !== profileId || !p.is_active) throw new BookingError('forbidden', 'Data pasien tidak ditemukan.')
  if (!p.account_linked_at) throw new BookingError('not_linked', 'Hubungkan akun Anda dengan data pasien klinik terlebih dahulu.')
  return p
}

// ── Options ─────────────────────────────────────────────────────────────────

export interface BookingOptions {
  branches: { id: string; name: string }[]
  defaultBranchId: string | null
  packages: { id: string; name: string; branchId: string | null; total: number; remaining: number }[]
  services: { id: string; name: string; branchId: string; price: number; serviceType: string }[]
}

export async function getBookingOptions(patientId: string, profileId: string): Promise<BookingOptions> {
  const admin = createAdminClient()
  await loadLinkedPatient(admin, patientId, profileId)

  const [{ data: branches }, { data: lastVisit }, { data: pkgs }, { data: layanan }] = await Promise.all([
    admin.from('branches').select('id, name').eq('is_active', true).order('name'),
    admin.from('patient_visits').select('branch_id').eq('patient_id', patientId)
      .order('visit_date', { ascending: false }).limit(1).maybeSingle(),
    admin.from('patient_packages')
      .select('id, package_name, branch_id, total_sessions, legacy_used_sessions, category')
      .eq('patient_id', patientId).eq('status', 'active'),
    admin.from('internal_layanan')
      .select('id, nama, harga, branch_id, online_service_type')
      .eq('is_active', true).not('online_service_type', 'is', null).order('nama'),
  ])

  const clinicPkgs = (pkgs ?? []).filter((p) => (p.category ?? 'PAKET KLINIK') === 'PAKET KLINIK')
  const used = new Map<string, number>()
  if (clinicPkgs.length > 0) {
    // Same rule as countBookedSessions (app/actions/packages.ts).
    const { data: visits } = await admin
      .from('patient_visits')
      .select('package_id')
      .in('package_id', clinicPkgs.map((p) => p.id))
      .neq('status', 'cancelled')
      .or('kehadiran.eq.HADIR,and(status.eq.scheduled,kehadiran.is.null)')
    for (const v of visits ?? []) if (v.package_id) used.set(v.package_id, (used.get(v.package_id) ?? 0) + 1)
  }

  return {
    branches: branches ?? [],
    defaultBranchId: lastVisit?.branch_id ?? null,
    packages: clinicPkgs
      .map((p) => ({
        id: p.id,
        name: p.package_name,
        branchId: p.branch_id,
        total: p.total_sessions,
        remaining: p.total_sessions - (p.legacy_used_sessions ?? 0) - (used.get(p.id) ?? 0),
      }))
      .filter((p) => p.remaining > 0),
    services: (layanan ?? [])
      .filter((l) => Number(l.harga) >= 1000)
      .map((l) => ({ id: l.id, name: l.nama, branchId: l.branch_id, price: Number(l.harga), serviceType: l.online_service_type })),
  }
}

// ── Availability ────────────────────────────────────────────────────────────

export async function getAvailability(branchId: string, date: string): Promise<AvailableHour[]> {
  assertBookableDate(date)
  const admin = createAdminClient()
  const day = dateAtNoon(date)
  const hari = toHariIndonesia(day)
  const weekGroup = getWeekGroupForDate(day)
  const PROFILE_COLS = 'full_name, avatar_url, nickname, gender, role, branch_id'

  const [schedules, overrides, leaves, slots, visits, holds] = await Promise.all([
    admin.from('schedules')
      .select(`staff_id, branch_id, shift, jam_mulai, jam_selesai, internal_profiles!staff_id(${PROFILE_COLS})`)
      .eq('hari', hari).eq('status', 'AKTIF').in('week_group', [weekGroup, 'SEMUA']),
    admin.from('schedule_overrides')
      .select(`id, staff_id, branch_id, hari, shift, jam_mulai, jam_selesai, internal_profiles!staff_id(${PROFILE_COLS})`)
      .eq('status', 'active').lte('start_date', date).gte('end_date', date),
    admin.from('leave_requests')
      .select('id, staff_id, reason, status, start_date, end_date')
      .in('status', ['approved', 'pending']).lte('start_date', date).gte('end_date', date),
    admin.from('schedule_slots').select('shift, slot_time').eq('branch_id', branchId).eq('is_active', true).order('slot_time'),
    admin.from('patient_visits').select('attending_staff_id, visit_time')
      .eq('visit_date', date).neq('status', 'cancelled').not('attending_staff_id', 'is', null),
    admin.from('online_bookings').select('staff_id, visit_hour, status, expires_at, visit_id')
      .eq('visit_date', date).in('status', ['pending_payment', 'confirmed']),
  ])

  const { entries } = buildScheduledStaff({
    hari,
    branchId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schedules: (schedules.data ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    overrides: (overrides.data ?? []) as any[],
    leaves: leaves.data ?? [],
  })
  // Only therapists take online bookings (admins/managers may have shifts too).
  const roleOf = new Map<string, string | null>()
  for (const r of [...(schedules.data ?? []), ...(overrides.data ?? [])] as { staff_id: string; internal_profiles?: { role?: string | null } | null }[]) {
    roleOf.set(r.staff_id, r.internal_profiles?.role ?? null)
  }
  const staff = [...entries.values()].filter((s) => roleOf.get(s.staff_id) === 'therapist')

  const now = Date.now()
  const busy: BusyRow[] = [
    ...(visits.data ?? [])
      .filter((v) => v.visit_time)
      .map((v) => ({ staff_id: v.attending_staff_id as string, hour: parseInt(String(v.visit_time).split(':')[0], 10) })),
    ...(holds.data ?? [])
      .filter((h) => (h.status === 'pending_payment' && h.expires_at && Date.parse(h.expires_at) > now)
        || (h.status === 'confirmed' && !h.visit_id))
      .map((h) => ({ staff_id: h.staff_id, hour: h.visit_hour })),
  ]

  return computeAvailability({ date, staff, slots: slots.data ?? [], busy })
}

// ── Create ──────────────────────────────────────────────────────────────────

export interface CreateBookingInput {
  patientId: string
  profileId: string
  branchId: string
  date: string
  hour: number
  /** null = any free therapist */
  staffId: string | null
  mode: 'package' | 'pay'
  packageId?: string | null
  layananId?: string | null
  method?: 'QRIS' | 'VA'
  /** gangsehat status page; DOKU returns the patient here after paying */
  returnUrl: string
}

export interface CreateBookingResult {
  bookingId: string
  status: 'confirmed' | 'pending_payment'
  checkoutUrl: string | null
}

const RESERVE_ERRORS: Record<string, string> = {
  patient_busy: 'Anda sudah memiliki jadwal di jam tersebut.',
  package_full: 'Sesi paket Anda sudah habis terjadwal.',
  package_invalid: 'Paket tidak dapat digunakan.',
}

export async function createOnlineBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const admin = createAdminClient()
  const patient = await loadLinkedPatient(admin, input.patientId, input.profileId)
  if (!Number.isInteger(input.hour)) throw new BookingError('invalid_slot', 'Jam tidak valid.')

  let serviceType: string
  let amount = 0
  let layananName: string | null = null
  if (input.mode === 'package') {
    if (!input.packageId) throw new BookingError('invalid_package', 'Pilih paket.')
    serviceType = 'PAKET TERAPI'
  } else if (input.mode === 'pay') {
    if (!input.layananId) throw new BookingError('invalid_service', 'Pilih layanan.')
    if (input.method !== 'QRIS' && input.method !== 'VA') throw new BookingError('invalid_method', 'Pilih metode pembayaran.')
    if (!dokuEnabled()) throw new BookingError('payment_unavailable', 'Pembayaran online belum tersedia.')
    const { data: l } = await admin
      .from('internal_layanan')
      .select('id, nama, harga, branch_id, is_active, online_service_type')
      .eq('id', input.layananId)
      .maybeSingle()
    if (!l || !l.is_active || !l.online_service_type || l.branch_id !== input.branchId || Number(l.harga) < 1000) {
      throw new BookingError('invalid_service', 'Layanan tidak tersedia untuk booking online.')
    }
    serviceType = l.online_service_type
    amount = Math.round(Number(l.harga))
    layananName = l.nama
  } else {
    throw new BookingError('invalid_mode', 'Mode booking tidak valid.')
  }

  // Server-side availability: the requested therapist (or any) must be free.
  const hours = await getAvailability(input.branchId, input.date)
  const slot = hours.find((h) => h.hour === input.hour)
  const candidates = (slot?.therapists ?? [])
    .map((t) => t.id)
    .filter((id) => !input.staffId || id === input.staffId)
  if (candidates.length === 0) throw new BookingError('slot_taken', 'Jam ini sudah tidak tersedia. Silakan pilih jam lain.')

  const expiresAt = input.mode === 'pay' ? new Date(Date.now() + PAY_HOLD_MINUTES * 60_000).toISOString() : null
  let bookingId: string | null = null
  for (const staffId of candidates) {
    const { data, error } = await admin.rpc('reserve_online_booking', {
      p_patient: input.patientId,
      p_profile: input.profileId,
      p_branch: input.branchId,
      p_staff: staffId,
      p_date: input.date,
      p_hour: input.hour,
      p_shift: slot!.shift,
      p_mode: input.mode,
      p_package: input.mode === 'package' ? input.packageId : null,
      p_layanan: input.mode === 'pay' ? input.layananId : null,
      p_service_type: serviceType,
      p_amount: amount,
      p_expires_at: expiresAt,
    })
    if (!error) { bookingId = data as string; break }
    const code = Object.keys(RESERVE_ERRORS).find((k) => error.message.includes(k))
    if (code) throw new BookingError(code, RESERVE_ERRORS[code])
    if (!error.message.includes('slot_taken')) {
      console.error('reserve_online_booking failed', error)
      throw new BookingError('unknown', 'Booking gagal. Silakan coba lagi.')
    }
  }
  if (!bookingId) throw new BookingError('slot_taken', 'Jam ini baru saja dipesan orang lain. Silakan pilih jam lain.')

  const { data: booking } = await admin.from('online_bookings').select(ONLINE_BOOKING_COLS).eq('id', bookingId).single()

  if (input.mode === 'package') {
    try {
      await insertOnlineVisit(admin, booking as OnlineBookingRow)
    } catch (error) {
      console.error('online booking: package visit insert failed', error)
      await admin.from('online_bookings').update({ status: 'cancelled' }).eq('id', bookingId)
      throw new BookingError('unknown', 'Booking gagal. Silakan coba lagi.')
    }
    return { bookingId, status: 'confirmed', checkoutUrl: null }
  }

  // Pay: open a DOKU checkout on the same merchant as staff payment links.
  const mode = gatewayMode()!
  const pii = decryptPatientPII({ encrypted_name: patient.encrypted_name, encrypted_phone: patient.encrypted_phone ?? '' })
  const pad = (n: number) => String(n).padStart(2, '0')
  const link = await insertPaymentLinkWithCheckout(admin, mode, {
    branch_id: input.branchId,
    patient_id: input.patientId,
    visit_id: null,
    order_id: null,
    online_booking_id: bookingId,
    method: input.method!,
    amount,
    harga: amount,
    discount: 0,
    category: SERVICE_TO_CATEGORY[serviceType as ServiceType] ?? serviceType,
    description: `${layananName} · ${input.date} ${pad(input.hour)}:00 · booking online`,
    customer_name: pii.name || 'Pasien Gang Sehat',
    customer_phone: pii.phone || null,
    customer_email: null,
    invoice_number: newInvoiceNumber(),
    environment: mode,
    status: 'pending',
    expires_at: expiresAt!,
    created_by: null,
  }, { dueMinutes: PAY_HOLD_MINUTES, returnUrl: input.returnUrl })

  if (link.error !== null) {
    await admin.from('online_bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', bookingId)
    throw new BookingError('payment_failed', link.error)
  }
  await admin.from('online_bookings')
    .update({ payment_link_id: link.id, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
  return { bookingId, status: 'pending_payment', checkoutUrl: link.checkoutUrl }
}

// ── Status ──────────────────────────────────────────────────────────────────

export interface BookingStatus {
  id: string
  status: OnlineBookingRow['status']
  date: string
  hour: number
  serviceType: string
  mode: 'package' | 'pay'
  amount: number
  branchName: string | null
  therapistName: string | null
  checkoutUrl: string | null
  expiresAt: string | null
}

export async function getOnlineBookingStatus(bookingId: string, profileId: string): Promise<BookingStatus> {
  const admin = createAdminClient()
  const load = () => admin
    .from('online_bookings')
    .select('id, status, visit_date, visit_hour, service_type, mode, amount, expires_at, payment_link_id, profile_id, branches!branch_id(name), internal_profiles!staff_id(full_name, nickname)')
    .eq('id', bookingId)
    .maybeSingle()

  let { data: b } = await load()
  if (!b || b.profile_id !== profileId) throw new BookingError('not_found', 'Booking tidak ditemukan.')

  // Settle on demand: works even where DOKU can't reach the webhook (localhost).
  if (b.status === 'pending_payment' && b.payment_link_id) {
    const link = await findLink({ id: b.payment_link_id }, admin)
    if (link && (link.status === 'pending' || link.status === 'paid')) {
      try { await syncPaymentLink(link, admin) } catch (error) { console.error('online booking status sync failed', error) }
      ;({ data: b } = await load())
      if (!b) throw new BookingError('not_found', 'Booking tidak ditemukan.')
    }
  }

  let checkoutUrl: string | null = null
  if (b.status === 'pending_payment' && b.payment_link_id) {
    const { data: l } = await admin.from('payment_links').select('checkout_url').eq('id', b.payment_link_id).maybeSingle()
    checkoutUrl = l?.checkout_url ?? null
  }
  type One<T> = T | T[] | null
  const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v)
  const therapist = one(b.internal_profiles as One<{ full_name: string; nickname: string | null }>)
  return {
    id: b.id,
    status: b.status,
    date: b.visit_date,
    hour: b.visit_hour,
    serviceType: b.service_type,
    mode: b.mode,
    amount: Number(b.amount),
    branchName: one(b.branches as One<{ name: string }>)?.name ?? null,
    therapistName: therapist ? therapist.nickname || therapist.full_name : null,
    checkoutUrl,
    expiresAt: b.expires_at,
  }
}
