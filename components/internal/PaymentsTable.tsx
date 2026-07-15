'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/components/order/constants'
import type { BookingPayment } from '@/app/actions/orders'

interface Props {
  payments: BookingPayment[]
  bookingId: string
  canEdit: boolean
  onRefresh: () => void
}

export function PaymentsTable({ payments, bookingId, canEdit, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<BookingPayment | null>(null)
  const [saving, setSaving] = useState(false)

  const totalPaid = payments.reduce((sum, p) => sum + (p.nominal ?? 0), 0)

  async function handleSave(form: Partial<BookingPayment>) {
    setSaving(true)
    const supabase = createClient()
    if (editingPayment) {
      await supabase.from('booking_payments').update({
        tanggal: form.tanggal,
        nominal: form.nominal,
        waktu_bayar: form.waktu_bayar || null,
        metode: form.metode || null,
        catatan: form.catatan || null,
      }).eq('id', editingPayment.id)
    } else {
      await supabase.from('booking_payments').insert({
        booking_id: bookingId,
        tanggal: form.tanggal ?? new Date().toISOString().slice(0, 10),
        nominal: form.nominal ?? 0,
        waktu_bayar: form.waktu_bayar || null,
        metode: form.metode || null,
        catatan: form.catatan || null,
      })
    }
    setSaving(false)
    setShowModal(false)
    setEditingPayment(null)
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus pembayaran ini?')) return
    await createClient().from('booking_payments').delete().eq('id', id)
    onRefresh()
  }

  function openAdd() {
    setEditingPayment(null)
    setShowModal(true)
  }

  function openEdit(p: BookingPayment) {
    setEditingPayment(p)
    setShowModal(true)
  }

  const colCount = canEdit ? 5 : 4

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Detail Bayar</h2>
          {payments.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Total terbayar:{' '}
              <span className="font-semibold text-green-600">{formatCurrency(totalPaid)}</span>
            </p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            <Plus size={12} /> Tambah Bayar
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-white dark:bg-card border border-gray-100 dark:border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/30 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tanggal</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Nominal Bayar</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Waktu Bayar</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Metode Pembayaran</th>
                {canEdit && (
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-gray-400">
                    Belum ada pembayaran tercatat.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-border hover:bg-gray-50/50 dark:hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDate(p.tanggal)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-foreground whitespace-nowrap">
                      {formatCurrency(p.nominal)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.waktu_bayar ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.metode ?? '—'}</td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <PaymentModal
          payment={editingPayment}
          methods={PAYMENT_METHODS}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingPayment(null) }}
          saving={saving}
        />
      )}
    </div>
  )
}

/* ─── Modal ──────────────────────────────────────────────────────── */

function PaymentModal({
  payment,
  methods,
  onSave,
  onClose,
  saving,
}: {
  payment: BookingPayment | null
  methods: string[]
  onSave: (form: Partial<BookingPayment>) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<Partial<BookingPayment>>({
    tanggal: payment?.tanggal ?? new Date().toISOString().slice(0, 10),
    nominal: payment?.nominal ?? 0,
    waktu_bayar: payment?.waktu_bayar ?? 'Booking',
    metode: payment?.metode ?? '',
    catatan: payment?.catatan ?? '',
  })

  const field = <T extends keyof typeof form>(key: T, value: (typeof form)[T]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 dark:text-foreground mb-4">
          {payment ? 'Edit Pembayaran' : 'Tambah Pembayaran'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
            <input type="date" value={form.tanggal ?? ''}
              onChange={(e) => field('tanggal', e.target.value)}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nominal</label>
            <input type="number" min={0} value={form.nominal ?? 0}
              onChange={(e) => field('nominal', Number(e.target.value))}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Waktu Bayar</label>
            <input type="text" value={form.waktu_bayar ?? ''}
              onChange={(e) => field('waktu_bayar', e.target.value)}
              placeholder="e.g. Booking, Pertemuan 1"
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Metode Pembayaran</label>
            <select value={form.metode ?? ''}
              onChange={(e) => field('metode', e.target.value)}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background">
              <option value="">— Pilih Metode —</option>
              {methods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Catatan</label>
            <textarea value={form.catatan ?? ''} rows={2}
              onChange={(e) => field('catatan', e.target.value)}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none bg-white dark:bg-background" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-border text-sm hover:bg-gray-50 dark:hover:bg-muted transition-colors">
            Batal
          </button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm transition-colors disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
