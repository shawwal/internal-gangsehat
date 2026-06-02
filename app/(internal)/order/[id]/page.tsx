'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, StopCircle, Trash2, RefreshCw, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchOrderDetail, fetchTherapistOptions } from '@/app/actions/orders'
import type { OrderDetail, TherapistOption } from '@/app/actions/orders'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { SessionsTable } from '@/components/internal/SessionsTable'
import { PaymentsTable } from '@/components/internal/PaymentsTable'
import { useProfile } from '@/hooks/useProfile'
import { formatCurrency, formatDate, formatWaNumber } from '@/lib/utils'

/* ─── helpers ──────────────────────────────────────────────────── */

function age(birthDate: string | null): string {
  if (!birthDate) return '—'
  const now = new Date()
  const birth = new Date(birthDate)
  return `${now.getFullYear() - birth.getFullYear()} Tahun`
}

function gender(g: string | null): string {
  if (g === 'male') return 'Laki-laki'
  if (g === 'female') return 'Perempuan'
  if (g === 'other') return 'Lainnya'
  return '—'
}

function discountLabel(pct: number | null): string {
  if (!pct || pct === 0) return 'Normal'
  return `${pct}%`
}

/* ─── info row ──────────────────────────────────────────────────── */

function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-right ${valueClass ?? 'text-foreground'}`}>{value}</span>
    </div>
  )
}

/* ─── page ─────────────────────────────────────────────────────── */

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const profile = useProfile()

  const [booking, setBooking] = useState<OrderDetail | null>(null)
  const [therapists, setTherapists] = useState<TherapistOption[]>([])
  const [loading, setLoading] = useState(true)
  const [stopping, setStopping] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = profile?.role !== 'therapist'
  const canEdit = isAdmin

  const load = useCallback(async () => {
    setLoading(true)
    const [data, opts] = await Promise.all([fetchOrderDetail(id), fetchTherapistOptions()])
    setBooking(data)
    setTherapists(opts)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleStop() {
    if (!booking) return
    if (!confirm('Stop order ini? Status akan berubah menjadi Cancelled.')) return
    setStopping(true)
    await createClient().from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id)
    setStopping(false)
    load()
  }

  async function handleDelete() {
    if (!booking) return
    if (!confirm('Hapus order ini permanen? Tindakan ini tidak bisa dibatalkan.')) return
    setDeleting(true)
    await createClient().from('bookings').delete().eq('id', id)
    setDeleting(false)
    router.push('/order')
  }

  /* ─── computed values ──────────────────────────── */

  const meta = booking?.internal_order_meta?.[0]
  const trxCode = meta?.kode_transaksi ?? '—'
  const paymentStatus = meta?.status_bayar ?? 'Belum Lunas'

  const sessions = booking?.booking_sessions ?? []
  const payments = booking?.booking_payments ?? []

  const totalPertemuan = sessions.length
  const sudahDiperiksa = sessions.filter((s) => s.status === 'Hadir').length
  const pertemuanSaatIni = sessions.find((s) => s.status === 'Belum Ditangani')?.session_number ?? sudahDiperiksa + 1
  const lastHadir = [...sessions].reverse().find((s) => s.status === 'Hadir')
  const batasPertemuan = sessions[sessions.length - 1]

  const harga = booking?.estimated_price ?? 0
  const discountPct = booking?.discount_percentage ?? 0
  const discountAmt = harga * discountPct / 100
  const total = booking?.discounted_price ?? harga - discountAmt
  const totalBayar = payments.reduce((s, p) => s + p.nominal, 0)
  const sisaBayar = total - totalBayar

  const waNumber = booking?._patientPhone ? formatWaNumber(booking._patientPhone) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={22} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Order tidak ditemukan.
        <br />
        <button onClick={() => router.push('/order')} className="mt-3 text-sm text-[var(--primary)] underline">
          Kembali ke daftar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-500 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-xs text-muted-foreground">No. Order</p>
            <h1 className="text-lg font-bold font-mono text-foreground">{trxCode}</h1>
          </div>
          <StatusBadge value={booking.status} />
          <StatusBadge value={paymentStatus} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-xl border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-500 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium transition-colors"
            >
              <Phone size={14} /> WA
            </a>
          )}
          {canEdit && !['completed', 'cancelled'].includes(booking.status) && (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <StopCircle size={14} /> Stop
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} /> Hapus
            </button>
          )}
        </div>
      </div>

      {/* 4 info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Order */}
        <div className="glass-card p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Order</p>
          <Row label="Layanan" value={booking.service_type} />
          <Row label="Tipe" value={booking.is_for_other ? 'Untuk Orang Lain' : 'Reguler'} />
          <Row label="Status" value={<StatusBadge value={booking.status} />} />
          <Row label="Kota" value={booking.city ?? '—'} />
          <Row label="Keluhan" value={booking.patient_notes ?? '—'} />
          {booking.is_for_other && (
            <>
              <Row label="Nama Wali" value={booking.parent_name ?? '—'} />
              <Row label="Pekerjaan Wali" value={booking.parent_job ?? '—'} />
            </>
          )}
          {booking.rating && (
            <Row label="Rating" value={`${'⭐'.repeat(booking.rating)} (${booking.rating}/5)`} />
          )}
        </div>

        {/* Pembayaran */}
        {isAdmin && (
          <div className="glass-card p-4 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pembayaran</p>
            <Row label="Harga" value={formatCurrency(harga)} />
            <Row label="Potongan" value={discountLabel(discountPct)} />
            {discountPct > 0 && (
              <Row label="Diskon" value={`− ${formatCurrency(discountAmt)}`} valueClass="text-green-600" />
            )}
            {(booking.distance_fee ?? 0) > 0 && (
              <Row label="Biaya Jarak" value={formatCurrency(booking.distance_fee)} />
            )}
            <Row label="Total" value={formatCurrency(total)} valueClass="text-foreground font-bold" />
            <div className="border-t border-white/20 pt-2 space-y-2">
              <Row label="Terbayar" value={formatCurrency(totalBayar)} valueClass="text-green-600" />
              <Row
                label="Sisa Bayar"
                value={formatCurrency(sisaBayar < 0 ? 0 : sisaBayar)}
                valueClass={sisaBayar > 0 ? 'text-orange-500' : 'text-green-600'}
              />
              <Row label="Status Bayar" value={<StatusBadge value={paymentStatus} />} />
            </div>
            {booking.payment_method && (
              <Row label="Metode" value={booking.payment_method} />
            )}
          </div>
        )}

        {/* Pertemuan */}
        <div className="glass-card p-4 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pertemuan</p>
          <Row label="Pertemuan Saat Ini" value={pertemuanSaatIni} />
          <Row label="Total Pertemuan" value={totalPertemuan || '—'} />
          <Row label="Sudah Diperiksa" value={sudahDiperiksa} />
          <Row label="Jadwal Ulang" value={sessions.filter(s => s.status === 'Tidak Hadir').length || '0'} />
          <Row
            label="Pertemuan Terakhir"
            value={lastHadir?.tanggal ? formatDate(lastHadir.tanggal) : '—'}
          />
          <Row
            label="Batas Berlaku"
            value={batasPertemuan?.tanggal ? formatDate(batasPertemuan.tanggal) : '—'}
          />
          {booking.therapist_notes && (
            <div className="border-t border-white/20 pt-2">
              <p className="text-xs text-muted-foreground mb-1">Diagnosa</p>
              <p className="text-sm text-foreground">{booking.therapist_notes}</p>
            </div>
          )}
        </div>

        {/* Pasien */}
        <div className="glass-card p-4 space-y-2.5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pasien</p>
          </div>
          <Row label="Nama" value={booking._patientName} valueClass="text-foreground font-semibold" />
          {booking._patientPhone && (
            <Row label="No HP" value={
              <a href={`https://wa.me/${formatWaNumber(booking._patientPhone)}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[var(--primary)] hover:underline">
                {booking._patientPhone}
              </a>
            } />
          )}
          {booking.guest_age && <Row label="Umur" value={`${booking.guest_age} Tahun`} />}
          {booking._patientBirthDate && (
            <>
              <Row label="Tanggal Lahir" value={formatDate(booking._patientBirthDate)} />
              <Row label="Umur" value={age(booking._patientBirthDate)} />
            </>
          )}
          {booking._patientGender && (
            <Row label="Jenis Kelamin" value={gender(booking._patientGender)} />
          )}
          {booking.guest_gender && !booking._patientGender && (
            <Row label="Jenis Kelamin" value={gender(booking.guest_gender)} />
          )}
          {booking.guest_email && <Row label="Email" value={booking.guest_email} />}
          {booking.admin_notes && (
            <div className="border-t border-white/20 pt-2">
              <p className="text-xs text-muted-foreground mb-1">Catatan Admin</p>
              <p className="text-sm text-foreground">{booking.admin_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sessions table */}
      <SessionsTable
        sessions={sessions}
        bookingId={id}
        scheduledDate={booking.scheduled_date}
        therapists={therapists}
        canEdit={canEdit}
        onRefresh={load}
      />

      {/* Payments table — admin only */}
      {isAdmin && (
        <PaymentsTable
          payments={payments}
          bookingId={id}
          canEdit={canEdit}
          onRefresh={load}
        />
      )}
    </div>
  )
}
