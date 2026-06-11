'use client'

import { useState } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateSessionAndRecordVisit } from '@/app/actions/orderPackages'
import { StatusBadge } from './StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingSession, TherapistOption } from '@/app/actions/orders'

interface Props {
  sessions: BookingSession[]
  bookingId: string
  scheduledDate: string | null
  therapists: TherapistOption[]
  canEdit: boolean
  onRefresh: () => void
}

const SESSION_STATUSES = ['Belum Ditangani', 'Hadir', 'Tidak Hadir', 'Batal']

export function SessionsTable({ sessions, bookingId, scheduledDate, therapists, canEdit, onRefresh }: Props) {
  const [editingSession, setEditingSession] = useState<BookingSession | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genCount, setGenCount] = useState(5)
  const [showGenModal, setShowGenModal] = useState(false)

  async function handleSaveSession(form: Partial<BookingSession>) {
    if (!editingSession) return
    setSaving(true)
    // Server action: updates booking_session + creates patient_visit when status='Hadir'
    await updateSessionAndRecordVisit(editingSession.id, form, bookingId)
    setSaving(false)
    setEditingSession(null)
    onRefresh()
  }

  async function handleGenerate(count: number) {
    setGenerating(true)
    const supabase = createClient()
    const baseDate = scheduledDate ? new Date(scheduledDate + 'T00:00:00') : new Date()
    const existing = new Set(sessions.map((s) => s.session_number))
    const toInsert = []
    for (let i = 1; i <= count; i++) {
      if (!existing.has(i)) {
        const d = new Date(baseDate)
        d.setDate(d.getDate() + (i - 1) * 7)
        toInsert.push({
          booking_id: bookingId,
          session_number: i,
          tanggal: d.toISOString().slice(0, 10),
        })
      }
    }
    if (toInsert.length > 0) {
      await supabase.from('booking_sessions').insert(toInsert)
    }
    setGenerating(false)
    setShowGenModal(false)
    onRefresh()
  }

  async function handleWaIncrement(session: BookingSession, type: 'order' | 'reminder') {
    const field = type === 'order' ? 'wa_order_count' : 'wa_reminder_count'
    const current = type === 'order' ? session.wa_order_count : session.wa_reminder_count
    await createClient()
      .from('booking_sessions')
      .update({ [field]: current + 1 })
      .eq('id', session.id)
    onRefresh()
  }

  const colCount = canEdit ? 13 : 12

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">Detail Order</h2>
        {canEdit && (
          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={12} /> Generate Sesi
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-white dark:bg-card border border-gray-100 dark:border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/30 text-left">
                {['Ke', 'Tanggal', 'Jam', 'Fisio', 'Kehadiran', 'Status', 'Nominal', 'Pembayaran', 'Keterangan', 'Catatan Admin', 'WA Order', 'WA Reminder'].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
                {canEdit && <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-center">Opsi</th>}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-gray-400">
                    Belum ada sesi.{canEdit && ' Klik "Generate Sesi" untuk membuat.'}
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 dark:border-border hover:bg-amber-50/20 dark:hover:bg-amber-900/5 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">Ke-{s.session_number}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {s.tanggal ? formatDate(s.tanggal) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.jam?.slice(0, 5) ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {s.therapists?.profiles?.full_name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{s.kehadiran ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge value={s.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-200 whitespace-nowrap font-medium">
                      {s.nominal_bayar > 0 ? formatCurrency(s.nominal_bayar) : 'Rp0'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.metode_pembayaran ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 max-w-[120px] truncate">{s.keterangan ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 max-w-[120px] truncate">{s.catatan_admin ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleWaIncrement(s, 'order')}
                        title="Kirim WA Order"
                        className="text-[10px] text-green-600 hover:text-green-700 font-semibold transition-colors"
                      >
                        {s.wa_order_count}x 📱
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleWaIncrement(s, 'reminder')}
                        title="Kirim WA Reminder"
                        className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                      >
                        {s.wa_reminder_count}x 📱
                      </button>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => setEditingSession(s)}
                          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-muted text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate sessions modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-foreground mb-1">Generate Sesi</h3>
            <p className="text-xs text-gray-400 mb-4">Sesi dijadwalkan setiap minggu dari tanggal booking.</p>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Jumlah Sesi</label>
            <input
              type="number"
              min={1}
              max={20}
              value={genCount}
              onChange={(e) => setGenCount(Math.max(1, Number(e.target.value)))}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowGenModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-border text-sm hover:bg-gray-50 dark:hover:bg-muted transition-colors"
              >Batal</button>
              <button
                onClick={() => handleGenerate(genCount)}
                disabled={generating}
                className="flex-1 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {generating ? 'Membuat...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit session modal */}
      {editingSession && (
        <SessionEditModal
          session={editingSession}
          therapists={therapists}
          statuses={SESSION_STATUSES}
          onSave={handleSaveSession}
          onClose={() => setEditingSession(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

/* ─── Edit modal ─────────────────────────────────────────────────── */

function SessionEditModal({
  session,
  therapists,
  statuses,
  onSave,
  onClose,
  saving,
}: {
  session: BookingSession
  therapists: TherapistOption[]
  statuses: string[]
  onSave: (form: Partial<BookingSession>) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<Partial<BookingSession>>({
    tanggal: session.tanggal ?? '',
    jam: session.jam?.slice(0, 5) ?? '',
    therapist_id: session.therapist_id ?? '',
    status: session.status,
    kehadiran: session.kehadiran ?? '',
    nominal_bayar: session.nominal_bayar,
    metode_pembayaran: session.metode_pembayaran ?? '',
    keterangan: session.keterangan ?? '',
    catatan_admin: session.catatan_admin ?? '',
  })

  const field = <T extends keyof typeof form>(key: T, value: (typeof form)[T]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 my-4">
        <h3 className="font-semibold text-gray-900 dark:text-foreground mb-4">
          Edit Sesi Ke-{session.session_number}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
              <input type="date" value={form.tanggal ?? ''} onChange={(e) => field('tanggal', e.target.value)}
                className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Jam</label>
              <input type="time" value={form.jam ?? ''} onChange={(e) => field('jam', e.target.value)}
                className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Fisioterapis</label>
            <select value={form.therapist_id ?? ''} onChange={(e) => field('therapist_id', e.target.value)}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background">
              <option value="">— Pilih Fisio —</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={form.status ?? 'Belum Ditangani'} onChange={(e) => field('status', e.target.value)}
                className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background">
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kehadiran</label>
              <select value={form.kehadiran ?? ''} onChange={(e) => field('kehadiran', e.target.value)}
                className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background">
                <option value="">—</option>
                <option value="Hadir">Hadir</option>
                <option value="Tidak Hadir">Tidak Hadir</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nominal Bayar</label>
              <input type="number" min={0} value={form.nominal_bayar ?? 0}
                onChange={(e) => field('nominal_bayar', Number(e.target.value))}
                className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Metode Pembayaran</label>
              <input type="text" value={form.metode_pembayaran ?? ''} placeholder="e.g. Tunai, BCA"
                onChange={(e) => field('metode_pembayaran', e.target.value)}
                className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-white dark:bg-background" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Keterangan</label>
            <textarea value={form.keterangan ?? ''} rows={2} onChange={(e) => field('keterangan', e.target.value)}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none bg-white dark:bg-background" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Catatan Admin</label>
            <textarea value={form.catatan_admin ?? ''} rows={2} onChange={(e) => field('catatan_admin', e.target.value)}
              className="w-full border border-gray-200 dark:border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none bg-white dark:bg-background" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-border text-sm hover:bg-gray-50 dark:hover:bg-muted transition-colors">
            Batal
          </button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
