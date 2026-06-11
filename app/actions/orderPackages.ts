'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import type { PackageOrderRow, PackageStats } from '@/components/orders/types'
import type { BookingSession } from './orders'

// ── Service type mapping: booking → patient_visits enum ──────────────────────
const VISIT_SERVICE_TYPES = [
  'TERAPI AWAL', 'PAKET TERAPI', 'SESI TERAPI',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA',
] as const
type VisitServiceType = typeof VISIT_SERVICE_TYPES[number]

function mapToVisitServiceType(bookingServiceType: string): VisitServiceType {
  const t = bookingServiceType.toUpperCase()
  if (t.includes('PAKET') && t.includes('VISIT')) return 'PAKET VISIT'
  if (t.includes('SESI') && t.includes('VISIT')) return 'SESI VISIT'
  if (t.includes('TA VISIT') || (t.includes('TERAPI AWAL') && t.includes('VISIT'))) return 'TA VISIT'
  if (t.includes('PAKET')) return 'PAKET TERAPI'
  if (t.includes('SESI')) return 'SESI TERAPI'
  if (t.includes('TA') || t.includes('TERAPI AWAL') || t === 'TA') return 'TERAPI AWAL'
  return 'LAINNYA'
}

// ── Compute days between two date strings ────────────────────────────────────
function daysBetween(dateStr: string): number {
  const target = new Date(dateStr)
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - target.getTime()) / 86_400_000)
}

// ── Fetch package orders (in_progress bookings with PAKET service type) ───────
export async function fetchPackageOrders(opts: {
  search?: string
  page?: number
  pageSize?: number
  statusFilter?: string
}): Promise<{ data: PackageOrderRow[]; count: number; stats: PackageStats }> {
  const { search = '', page = 1, pageSize = 10, statusFilter = 'in_progress' } = opts
  const supabase = await createClient()

  // Fetch all matching bookings with sessions (no pagination yet — need to decrypt names first)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('bookings')
    .select(`
      id, service_type, status, created_at,
      patients ( encrypted_name, encrypted_phone ),
      therapists ( profiles ( full_name ) ),
      internal_order_meta ( kode_transaksi, status_bayar ),
      booking_sessions ( id, session_number, tanggal, status )
    `)
    .ilike('service_type', '%PAKET%')
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw } = await query as { data: any[] | null }
  const rows = raw ?? []

  // Decrypt and transform
  const transformed: PackageOrderRow[] = rows.map((r) => {
    let patientName  = r.guest_name  ?? '—'
    let patientPhone = r.guest_phone ?? ''

    if (r.patients) {
      try {
        const pii = decryptPatientPII({
          encrypted_name:  r.patients.encrypted_name  ?? '',
          encrypted_phone: r.patients.encrypted_phone ?? '',
        })
        if (pii.name)  patientName  = pii.name
        if (pii.phone) patientPhone = pii.phone
      } catch { /* ignore decryption failures */ }
    }

    const sessions: { tanggal: string | null; status: string }[] = r.booking_sessions ?? []

    const hadirDates = sessions
      .filter((s) => s.status === 'Hadir' && s.tanggal)
      .map((s) => s.tanggal as string)
      .sort()

    const pendingDates = sessions
      .filter((s) => s.status === 'Belum Ditangani' && s.tanggal)
      .map((s) => s.tanggal as string)
      .sort()

    const lastHadirDate   = hadirDates.at(-1) ?? null
    const nextSessionDate = pendingDates[0] ?? null
    const daysSinceLast   = lastHadirDate ? daysBetween(lastHadirDate) : null

    return {
      id:               r.id,
      kode_transaksi:   r.internal_order_meta?.[0]?.kode_transaksi ?? '—',
      patient_name:     patientName,
      patient_phone:    patientPhone,
      patient_id:       r.patient_id ?? null,
      service_type:     r.service_type,
      status:           r.status,
      admin_name:       r.therapists?.profiles?.full_name ?? '—',
      total_sessions:   sessions.length,
      last_hadir_date:  lastHadirDate,
      next_session_date: nextSessionDate,
      days_since_last:  daysSinceLast,
    }
  })

  // Search filter (on decrypted name)
  const filtered = search.trim()
    ? transformed.filter((r) =>
        r.patient_name.toLowerCase().includes(search.toLowerCase()) ||
        r.kode_transaksi.toLowerCase().includes(search.toLowerCase()) ||
        r.service_type.toLowerCase().includes(search.toLowerCase())
      )
    : transformed

  // Stats
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const { count: completedThisMonth } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .ilike('service_type', '%PAKET%')
    .gte('created_at', firstOfMonth)

  const stats: PackageStats = {
    activePackages:     rows.length,
    overdueCount:       filtered.filter((r) => r.days_since_last !== null && r.days_since_last > 14).length,
    completedThisMonth: completedThisMonth ?? 0,
  }

  // Paginate
  const count = filtered.length
  const from  = (page - 1) * pageSize
  const data  = filtered.slice(from, from + pageSize)

  return { data, count, stats }
}

// ── Update session and optionally record a patient_visit ─────────────────────
export async function updateSessionAndRecordVisit(
  sessionId: string,
  form: Partial<BookingSession>,
  bookingId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // 1. Update booking_session
  const { error: sessionError } = await supabase
    .from('booking_sessions')
    .update({
      tanggal:            form.tanggal            || null,
      jam:                form.jam                || null,
      therapist_id:       form.therapist_id       || null,
      status:             form.status,
      kehadiran:          form.kehadiran          || null,
      nominal_bayar:      form.nominal_bayar      ?? 0,
      metode_pembayaran:  form.metode_pembayaran  || null,
      keterangan:         form.keterangan         || null,
      catatan_admin:      form.catatan_admin      || null,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (sessionError) return { error: sessionError.message }

  // 2. If marked Hadir with a date, record a patient_visit
  if (form.status === 'Hadir' && form.tanggal) {
    // Fetch booking to get patient_id and service_type
    const { data: booking } = await supabase
      .from('bookings')
      .select('patient_id, service_type')
      .eq('id', bookingId)
      .single()

    if (booking?.patient_id) {
      // Get current user's branch_id
      const { data: { user } } = await supabase.auth.getUser()
      let branchId: string | null = null

      if (user) {
        const { data: profile } = await supabase
          .from('internal_profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single()
        branchId = profile?.branch_id ?? null
      }

      // Only create visit if we have a branch (non-director)
      if (branchId) {
        const visitServiceType = mapToVisitServiceType(booking.service_type ?? '')

        // Check for existing visit on same patient+date to avoid duplicates
        const { data: existing } = await supabase
          .from('patient_visits')
          .select('id')
          .eq('patient_id', booking.patient_id)
          .eq('visit_date', form.tanggal)
          .eq('branch_id', branchId)
          .maybeSingle()

        if (existing) {
          // Update existing record
          await supabase
            .from('patient_visits')
            .update({
              status:       'completed',
              kehadiran:    'HADIR',
              service_type: visitServiceType,
            })
            .eq('id', existing.id)
        } else {
          // Insert new record
          await supabase
            .from('patient_visits')
            .insert({
              patient_id:   booking.patient_id,
              branch_id:    branchId,
              visit_date:   form.tanggal,
              service_type: visitServiceType,
              status:       'completed',
              kehadiran:    'HADIR',
              attending_staff_id: user?.id ?? null,
            })
        }
      }
    }
  }

  return { error: null }
}
