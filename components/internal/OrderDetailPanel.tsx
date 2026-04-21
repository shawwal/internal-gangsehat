'use client'

import { X, Phone } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import { formatCurrency, formatDate, formatWaNumber } from '@/lib/utils'
import type { BookingRow } from '@/types'

interface Props {
  booking: BookingRow | null
  onClose: () => void
  showAmounts: boolean
  onMarkPaid: (row: BookingRow) => Promise<void>
  onStop: (row: BookingRow) => Promise<void>
  onAttend: (row: BookingRow) => Promise<void>
}

export function OrderDetailPanel({ booking, onClose, showAmounts, onMarkPaid, onStop, onAttend }: Props) {
  const { t } = useTranslation()

  if (!booking) return null

  const meta = booking.internal_order_meta?.[0]
  const patientName = booking.guest_name ?? booking.patients?.encrypted_name ?? '—'
  const patientPhone = booking.guest_phone ?? booking.patients?.encrypted_phone ?? ''
  const therapistName = booking.therapists?.profiles?.full_name ?? '—'
  const total = booking.discounted_price ?? booking.estimated_price ?? 0
  const paymentStatus = meta?.status_bayar ?? 'Belum Lunas'

  const scheduledDate = booking.scheduled_date
  const scheduledTime = booking.scheduled_time

  function waLink() {
    if (!patientPhone) return null
    const num = formatWaNumber(patientPhone)
    const msg = encodeURIComponent(
      `Halo ${patientName}, kami dari TeamFGS ingin mengingatkan jadwal fisioterapi Anda pada ${formatDate(scheduledDate)} pukul ${scheduledTime}. Terima kasih.`
    )
    return `https://wa.me/${num}?text=${msg}`
  }

  const wa = waLink()
  const canMarkPaid = paymentStatus === 'Belum Lunas'
  const canStop = !['completed', 'cancelled'].includes(booking.status)
  const canAttend = ['waiting_confirmation', 'confirmed'].includes(booking.status)

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <p className="font-mono text-sm font-medium text-gray-700">
              {meta?.kode_transaksi ?? '—'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge value={booking.status} />
              <StatusBadge value={paymentStatus} />
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Patient */}
          <section className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pasien</p>
            <p className="font-semibold text-gray-900">{patientName}</p>
            {patientPhone && (
              <p className="text-sm text-gray-500 mt-0.5 font-mono tracking-wide">{patientPhone}</p>
            )}
          </section>

          {/* Therapist */}
          <section className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fisioterapis</p>
            <p className="font-semibold text-gray-900">{therapistName}</p>
          </section>

          {/* Service + Schedule */}
          <section className="rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Layanan</p>
            <p className="font-semibold text-gray-900">{booking.service_type}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formatDate(booking.scheduled_date)} · {booking.scheduled_time}
            </p>
          </section>

          {/* Payment — admin only */}
          {showAmounts && (
            <section className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pembayaran</p>
              <div className="space-y-2 text-sm">
                {booking.estimated_price != null && (
                  <div className="flex justify-between text-gray-600">
                    <span>Estimasi</span>
                    <span>{formatCurrency(booking.estimated_price)}</span>
                  </div>
                )}
                {(booking.discount_percentage ?? 0) > 0 && booking.estimated_price != null && (
                  <div className="flex justify-between text-green-600">
                    <span>Diskon ({booking.discount_percentage}%)</span>
                    <span>-{formatCurrency(booking.estimated_price * (booking.discount_percentage ?? 0) / 100)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-2 mt-1">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {booking.payment_method && (
                  <div className="flex justify-between text-gray-500">
                    <span>Metode</span>
                    <span className="capitalize">{booking.payment_method}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Admin notes */}
          {(meta?.catatan_admin || booking.admin_notes) && (
            <section className="rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Catatan</p>
              <p className="text-sm text-gray-700">{meta?.catatan_admin ?? booking.admin_notes}</p>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-2">
            {canMarkPaid && (
              <button
                onClick={() => onMarkPaid(booking)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors"
              >
                {t('actions.mark_paid')}
              </button>
            )}
            {canAttend && (
              <button
                onClick={() => onAttend(booking)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                {t('actions.attend')}
              </button>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-[#25D366] hover:bg-[#1ebe5d] text-white transition-colors"
              >
                <Phone size={14} />
                {t('actions.send_wa')}
              </a>
            )}
            {canStop && (
              <button
                onClick={() => onStop(booking)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {t('actions.stop_order')}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
