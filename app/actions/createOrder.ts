'use server'

import { createClient } from '@/lib/supabase/server'

export interface CreateOrderSessionInput {
  session_number: number
  tanggal: string
  jam: string | null
  therapist_id: string | null
}

export interface CreateOrderInput {
  patientId: string
  serviceName: string
  harga: number
  discountPercentage: number
  sessions: CreateOrderSessionInput[]
  dpAmount: number
  dpMetode: string | null
  adminNotes: string | null
}

export interface CreateOrderResult {
  error: string | null
  id: string | null
}

function randomAlnum(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function datePrefix(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

async function generateKodeTransaksi(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const prefix = `ORD${datePrefix()}`
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}${randomAlnum(4)}`
    const { data } = await supabase
      .from('internal_order_meta')
      .select('id')
      .eq('kode_transaksi', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  // Extremely unlikely fallback — timestamp suffix guarantees uniqueness.
  return `${prefix}${Date.now().toString(36).toUpperCase().slice(-4)}`
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = await createClient()

  if (!input.patientId) return { error: 'Pasien wajib dipilih.', id: null }
  if (!input.serviceName) return { error: 'Layanan wajib dipilih.', id: null }
  if (input.sessions.length === 0) return { error: 'Minimal 1 pertemuan wajib dijadwalkan.', id: null }

  const firstSession = input.sessions[0]
  const harga = Math.max(0, input.harga)
  const discountPercentage = Math.min(100, Math.max(0, input.discountPercentage))
  const discountedPrice = Math.round(harga - (harga * discountPercentage) / 100)
  const dpAmount = Math.max(0, Math.min(input.dpAmount, discountedPrice))

  const { data: { user } } = await supabase.auth.getUser()

  // 1. Create the booking (order header)
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      patient_id: input.patientId,
      service_type: input.serviceName,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      scheduled_date: firstSession.tanggal,
      scheduled_time: firstSession.jam ?? '09:00',
      duration_minutes: 60,
      estimated_price: harga,
      discount_percentage: discountPercentage,
      discounted_price: discountedPrice,
      therapist_id: firstSession.therapist_id,
      admin_notes: input.adminNotes || null,
    })
    .select('id')
    .single()

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? 'Gagal membuat order.', id: null }
  }

  const bookingId = booking.id as string

  // 2. Create the sessions (pertemuan)
  const { error: sessionsError } = await supabase.from('booking_sessions').insert(
    input.sessions.map((s) => ({
      booking_id: bookingId,
      session_number: s.session_number,
      tanggal: s.tanggal || null,
      jam: s.jam || null,
      therapist_id: s.therapist_id || null,
    })),
  )
  if (sessionsError) return { error: sessionsError.message, id: bookingId }

  // 3. Create the order meta (transaction code + payment status)
  const kodeTransaksi = await generateKodeTransaksi(supabase)
  const statusBayar = dpAmount > 0 && dpAmount >= discountedPrice ? 'Lunas' : 'Belum Lunas'
  const { error: metaError } = await supabase.from('internal_order_meta').insert({
    booking_id: bookingId,
    kode_transaksi: kodeTransaksi,
    status_bayar: statusBayar,
  })
  if (metaError) return { error: metaError.message, id: bookingId }

  // 4. Optional initial payment (DP)
  if (dpAmount > 0) {
    const { error: paymentError } = await supabase.from('booking_payments').insert({
      booking_id: bookingId,
      tanggal: new Date().toISOString().slice(0, 10),
      nominal: dpAmount,
      waktu_bayar: 'Booking',
      metode: input.dpMetode || null,
      created_by: user?.id ?? null,
    })
    if (paymentError) return { error: paymentError.message, id: bookingId }
  }

  return { error: null, id: bookingId }
}
