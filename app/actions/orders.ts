'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { normalizeBirthDate } from '@/lib/dates'
import { applyDateFilter } from '@/components/orders/helpers'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// ── Branch scoping for the orders list/detail ──────────────────────────────
// `bookings`/`booking_sessions` have no branch_id column and no RLS — a
// booking's branch is only derivable via its assigned therapist:
// bookings.therapist_id → therapists.profile_id → internal_profiles.branch_id
// (therapists.profile_id is the same auth.users id as the matching
// internal_profiles row for any staff member who's also bookable). Director
// and every other existing role stay unscoped (unchanged from today); only
// 'therapist' is scoped to their own branch, and can't see pricing anywhere
// on this feature.
export interface OrdersViewerScope {
  scope: 'all' | 'branch'
  branchTherapistIds: string[] | null  // null when scope === 'all'
  canSeePricing: boolean
}

async function resolveOrdersViewerScope(supabase: SupabaseServerClient): Promise<OrdersViewerScope> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { scope: 'branch', branchTherapistIds: [], canSeePricing: false }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'therapist') {
    return { scope: 'all', branchTherapistIds: null, canSeePricing: true }
  }
  if (!profile.branch_id) return { scope: 'branch', branchTherapistIds: [], canSeePricing: false }

  const { data: branchProfiles } = await supabase
    .from('internal_profiles')
    .select('id')
    .eq('branch_id', profile.branch_id)
  const branchProfileIds = (branchProfiles ?? []).map((p) => p.id as string)
  if (branchProfileIds.length === 0) return { scope: 'branch', branchTherapistIds: [], canSeePricing: false }

  const { data: branchTherapists } = await supabase
    .from('therapists')
    .select('id')
    .in('profile_id', branchProfileIds)

  return {
    scope: 'branch',
    branchTherapistIds: (branchTherapists ?? []).map((t) => t.id as string),
    canSeePricing: false,
  }
}

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
  // false when the caller (e.g. therapist) shouldn't see pricing — the price/
  // payment fields above are already nulled out server-side in that case, this
  // is just so the page can drive its own UI gating off the same signal.
  _canSeePricing: boolean
}

export async function fetchOrderDetail(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient()
  const viewer = await resolveOrdersViewerScope(supabase)

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

  // Branch check — a therapist can only view bookings assigned to a
  // colleague in their own branch. Treat "out of scope" the same as "doesn't
  // exist" (the page's existing missing-booking UI), so this also closes the
  // pre-existing gap where /order/[id] was reachable for any booking id
  // regardless of role (the route isn't registered in navigation.ts).
  if (viewer.scope === 'branch') {
    if (!data.therapist_id || !(viewer.branchTherapistIds ?? []).includes(data.therapist_id)) {
      return null
    }
  }

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
      patientBirthDate = normalizeBirthDate(pii.birthDate)
    } catch {
      // decryption failed — show raw value as fallback
    }
    patientGender = data.patients.gender
  }

  // Sort sessions by session_number
  let sessions = ((data.booking_sessions ?? []) as BookingSession[])
    .sort((a, b) => a.session_number - b.session_number)

  // Sort payments by created_at ascending
  let payments = ((data.booking_payments ?? []) as BookingPayment[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  // Redact pricing/payment data server-side when the caller can't see it —
  // the page already hides the Pembayaran card/table via its own role check,
  // this closes the gap where SessionsTable's Nominal/Pembayaran columns (and
  // the raw payload) still shipped the figures to anyone who could load the
  // page (see fetchOrderSessionsPreview's own comment for the same issue on
  // the orders list).
  let priceFields = {
    estimated_price:     data.estimated_price,
    discounted_price:    data.discounted_price,
    discount_percentage: data.discount_percentage,
    payment_method:      data.payment_method,
  }
  if (!viewer.canSeePricing) {
    priceFields = { estimated_price: null, discounted_price: null, discount_percentage: null, payment_method: null }
    sessions = sessions.map((s) => ({ ...s, nominal_bayar: 0, metode_pembayaran: null }))
    payments = []
  }

  return {
    ...(data as unknown as OrderDetail),
    ...priceFields,
    booking_sessions: sessions,
    booking_payments: payments,
    _patientName: patientName,
    _patientPhone: patientPhone,
    _patientBirthDate: patientBirthDate,
    _patientGender: patientGender,
    _canSeePricing: viewer.canSeePricing,
  }
}

// ── Resolve a bookings.id from its human-readable kode_transaksi ───────────────
// Used to link legacy TRX codes (stamped into patient_packages.notes on
// import) back to the /order/[id] detail page, which is keyed by bookings.id.
export async function fetchBookingIdByKode(kode: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_order_meta')
    .select('booking_id')
    .eq('kode_transaksi', kode)
    .maybeSingle()
  return data?.booking_id ?? null
}

export type TherapistOption = { id: string; name: string }

export async function fetchTherapistOptions(): Promise<TherapistOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('therapists')
    .select('id, profiles ( full_name )')
    .eq('is_available', true)
    .order('id')

  return ((data ?? []) as unknown as { id: string; profiles: { full_name: string } | null }[]).map((t) => ({
    id: t.id,
    name: t.profiles?.full_name ?? '—',
  }))
}

// ── Orders list (powers /director/orders and /order) ────────────────────────
// Moved server-side from useOrdersData.ts's old direct client-side query so the
// branch scope above is an actual boundary — a therapist can't strip a filter
// added only to a browser-side Supabase call via devtools, but they can't
// influence what this server action queries either (branchTherapistIds is
// resolved from their own session, never taken from the client).
export interface OrdersListParams {
  page: number
  pageSize: number
  search: string
  status: string
  payment: string  // '' | 'Belum Lunas' | 'Lunas'
  month: string
  year: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OrdersListResult { rows: any[]; total: number; scope: 'all' | 'branch'; canSeePricing: boolean }

export async function fetchOrdersList(params: OrdersListParams): Promise<OrdersListResult> {
  const supabase = await createClient()
  const viewer = await resolveOrdersViewerScope(supabase)

  if (viewer.scope === 'branch' && (viewer.branchTherapistIds?.length ?? 0) === 0) {
    return { rows: [], total: 0, scope: viewer.scope, canSeePricing: viewer.canSeePricing }
  }

  let paymentIds: string[] | null = null
  if (params.payment) {
    const { data } = await supabase
      .from('internal_order_meta')
      .select('booking_id')
      .eq('status_bayar', params.payment)
    paymentIds = (data ?? []).map((m) => m.booking_id as string)
    if (paymentIds.length === 0) return { rows: [], total: 0, scope: viewer.scope, canSeePricing: viewer.canSeePricing }
  }

  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('bookings')
    .select(`
      id, service_type, scheduled_date, scheduled_time, status,
      estimated_price, discounted_price, discount_percentage,
      guest_name, guest_phone, created_at,
      patients (
        encrypted_name,
        patient_packages ( id, package_name, total_sessions, t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, status )
      ),
      therapists ( profiles ( full_name ) ),
      internal_order_meta ( kode_transaksi, status_bayar )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.status)         q = q.eq('status', params.status)
  if (paymentIds !== null)   q = q.in('id', paymentIds)
  if (params.search.trim())  q = q.or(`guest_name.ilike.%${params.search.trim()}%,service_type.ilike.%${params.search.trim()}%`)
  q = applyDateFilter(q, params.month, params.year)
  if (viewer.scope === 'branch') q = q.in('therapist_id', viewer.branchTherapistIds)

  const { data, count } = await q

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map((row) => viewer.canSeePricing ? row : {
    ...row, estimated_price: null, discounted_price: null, discount_percentage: null,
  })

  return { rows, total: count ?? 0, scope: viewer.scope, canSeePricing: viewer.canSeePricing }
}

export interface OrdersStatsParams { month: string; year: string }

export interface OrdersStatsResult {
  total: number; booking: number; confirmed: number; inProgress: number
  completed: number; cancelled: number; belumLunas: number; lunas: number
  scope: 'all' | 'branch'
}

export async function fetchOrdersStats(params: OrdersStatsParams): Promise<OrdersStatsResult> {
  const supabase = await createClient()
  const viewer = await resolveOrdersViewerScope(supabase)
  const scoped = viewer.scope === 'branch'
  const therapistIds = viewer.branchTherapistIds ?? []

  if (scoped && therapistIds.length === 0) {
    return { total: 0, booking: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0, belumLunas: 0, lunas: 0, scope: viewer.scope }
  }

  function base(status?: string) {
    let q = supabase.from('bookings').select('id', { count: 'exact', head: true })
    if (status) q = q.eq('status', status)
    if (scoped) q = q.in('therapist_id', therapistIds)
    q = applyDateFilter(q, params.month, params.year)
    return q
  }

  const [totalR, bookingR, confirmedR, inProgR, completedR, cancelledR] = await Promise.all([
    base(), base('waiting_confirmation'), base('confirmed'),
    base('in_progress'), base('completed'), base('cancelled'),
  ])

  let belumLunas = 0, lunas = 0
  if (scoped) {
    const { data: branchBookings } = await supabase.from('bookings').select('id').in('therapist_id', therapistIds)
    const branchBookingIds = (branchBookings ?? []).map((b) => b.id as string)
    if (branchBookingIds.length > 0) {
      const [{ count: bl }, { count: l }] = await Promise.all([
        supabase.from('internal_order_meta').select('id', { count: 'exact', head: true }).eq('status_bayar', 'Belum Lunas').in('booking_id', branchBookingIds),
        supabase.from('internal_order_meta').select('id', { count: 'exact', head: true }).eq('status_bayar', 'Lunas').in('booking_id', branchBookingIds),
      ])
      belumLunas = bl ?? 0
      lunas = l ?? 0
    }
  } else {
    const [{ count: bl }, { count: l }] = await Promise.all([
      supabase.from('internal_order_meta').select('id', { count: 'exact', head: true }).eq('status_bayar', 'Belum Lunas'),
      supabase.from('internal_order_meta').select('id', { count: 'exact', head: true }).eq('status_bayar', 'Lunas'),
    ])
    belumLunas = bl ?? 0
    lunas = l ?? 0
  }

  return {
    total: totalR.count ?? 0, booking: bookingR.count ?? 0, confirmed: confirmedR.count ?? 0,
    inProgress: inProgR.count ?? 0, completed: completedR.count ?? 0, cancelled: cancelledR.count ?? 0,
    belumLunas, lunas, scope: viewer.scope,
  }
}

// ── Inline session preview for the orders list (expandable row) ────────────
export interface OrderSessionPreviewRow {
  id: string
  session_number: number
  tanggal: string | null
  jam: string | null
  therapist_name: string
  status: string
  keterangan: string | null
  nominal_bayar: number | null       // null when caller can't see pricing
  metode_pembayaran: string | null   // null when caller can't see pricing
}

export interface OrderSessionsPreviewResult {
  error: string | null
  sessions: OrderSessionPreviewRow[]
  canSeePricing: boolean
}

export async function fetchOrderSessionsPreview(bookingId: string): Promise<OrderSessionsPreviewResult> {
  const supabase = await createClient()
  const viewer = await resolveOrdersViewerScope(supabase)

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, therapist_id')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return { error: 'Order tidak ditemukan.', sessions: [], canSeePricing: viewer.canSeePricing }

  // Same branch check as fetchOrderDetail — this is what a therapist's inline
  // expand click and "Lihat Detail" link both go through.
  if (viewer.scope === 'branch') {
    if (!booking.therapist_id || !(viewer.branchTherapistIds ?? []).includes(booking.therapist_id)) {
      return { error: 'Order tidak ditemukan.', sessions: [], canSeePricing: false }
    }
  }

  const { data: sessions } = await supabase
    .from('booking_sessions')
    .select('id, session_number, tanggal, jam, status, keterangan, nominal_bayar, metode_pembayaran, therapists ( profiles ( full_name ) )')
    .eq('booking_id', bookingId)
    .order('session_number', { ascending: true })

  const rows: OrderSessionPreviewRow[] = ((sessions ?? []) as unknown as {
    id: string; session_number: number; tanggal: string | null; jam: string | null
    status: string; keterangan: string | null; nominal_bayar: number; metode_pembayaran: string | null
    therapists: { profiles: { full_name: string } | null } | null
  }[]).map((s) => ({
    id:                 s.id,
    session_number:     s.session_number,
    tanggal:            s.tanggal,
    jam:                s.jam,
    therapist_name:     s.therapists?.profiles?.full_name ?? '—',
    status:             s.status,
    keterangan:         s.keterangan,
    nominal_bayar:      viewer.canSeePricing ? s.nominal_bayar : null,
    metode_pembayaran:  viewer.canSeePricing ? s.metode_pembayaran : null,
  }))

  return { error: null, sessions: rows, canSeePricing: viewer.canSeePricing }
}
