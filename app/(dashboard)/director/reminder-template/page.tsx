'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, CalendarDays } from 'lucide-react'
import {
  fetchReminderTemplate, saveReminderTemplate,
  fetchOrderConfirmationTemplate, saveOrderConfirmationTemplate,
  fetchAdminPhone, saveAdminPhone,
} from '@/app/actions/reminder-template'
import { DEFAULT_REMINDER_TEMPLATE, DEFAULT_ORDER_CONFIRMATION_TEMPLATE } from '@/lib/utils'
import { TemplateEditorCard } from '@/components/reminderTemplate/TemplateEditorCard'

const REMINDER_PLACEHOLDERS = [
  { key: 'nama',        label: 'Nama pasien' },
  { key: 'tanggal',     label: 'Tanggal kunjungan' },
  { key: 'jam',         label: 'Jam kunjungan' },
  { key: 'layanan',     label: 'Jenis layanan' },
  { key: 'cabang',      label: 'Nama cabang' },
  { key: 'terapis',     label: 'Nama terapis' },
  { key: 'order_id',    label: 'Order ID' },
  { key: 'nomor_admin', label: 'Nomor WhatsApp admin' },
]

const CONFIRMATION_PLACEHOLDERS = [
  { key: 'nama',        label: 'Nama pasien' },
  { key: 'hari',        label: 'Hari kunjungan' },
  { key: 'tanggal',     label: 'Tanggal kunjungan' },
  { key: 'jam',         label: 'Jam kunjungan' },
  { key: 'layanan',     label: 'Jenis layanan' },
  { key: 'cabang',      label: 'Nama cabang' },
  { key: 'order_id',    label: 'Order ID' },
  { key: 'nomor_admin', label: 'Nomor WhatsApp admin' },
]

const REMINDER_SAMPLE = {
  nama:        'Budi Santoso',
  tanggal:     '15 Jul 2026',
  jam:         '09:00',
  layanan:     'SESI TERAPI',
  cabang:      'Fisioterapi Gang Sehat Pontianak',
  terapis:     'Suci',
  order_id:    'TRX/2026/07/0348',
  nomor_admin: '081234567890',
}

const CONFIRMATION_SAMPLE = {
  nama:        'Fransiskus Xaverius Christian Sungkono',
  hari:        'RABU',
  tanggal:     '19-08-2026',
  jam:         '11:00',
  layanan:     'SESI TERAPI',
  cabang:      'Fisioterapi Gang Sehat Pontianak',
  order_id:    'TRX/2026/08/0096',
  nomor_admin: '081234567890',
}

export default function ReminderTemplatePage() {
  const [loading, setLoading] = useState(true)

  const [reminderTemplate, setReminderTemplate] = useState('')
  const [reminderSaving, setReminderSaving]     = useState(false)
  const [reminderSaved, setReminderSaved]       = useState(false)
  const [reminderError, setReminderError]       = useState<string | null>(null)

  const [confirmationTemplate, setConfirmationTemplate] = useState('')
  const [confirmationSaving, setConfirmationSaving]     = useState(false)
  const [confirmationSaved, setConfirmationSaved]       = useState(false)
  const [confirmationError, setConfirmationError]       = useState<string | null>(null)

  const [adminPhone, setAdminPhone]       = useState('')
  const [phoneSaving, setPhoneSaving]     = useState(false)
  const [phoneSaved, setPhoneSaved]       = useState(false)
  const [phoneError, setPhoneError]       = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchReminderTemplate(),
      fetchOrderConfirmationTemplate(),
      fetchAdminPhone(),
    ]).then(([reminder, confirmation, phone]) => {
      setReminderTemplate(reminder)
      setConfirmationTemplate(confirmation)
      setAdminPhone(phone)
      setLoading(false)
    })
  }, [])

  async function handleSaveReminder() {
    setReminderSaving(true)
    setReminderError(null)
    setReminderSaved(false)
    const { error } = await saveReminderTemplate(reminderTemplate)
    setReminderSaving(false)
    if (error) { setReminderError(error); return }
    setReminderSaved(true)
    setTimeout(() => setReminderSaved(false), 2500)
  }

  async function handleSaveConfirmation() {
    setConfirmationSaving(true)
    setConfirmationError(null)
    setConfirmationSaved(false)
    const { error } = await saveOrderConfirmationTemplate(confirmationTemplate)
    setConfirmationSaving(false)
    if (error) { setConfirmationError(error); return }
    setConfirmationSaved(true)
    setTimeout(() => setConfirmationSaved(false), 2500)
  }

  async function handleSavePhone() {
    setPhoneSaving(true)
    setPhoneError(null)
    setPhoneSaved(false)
    const { error } = await saveAdminPhone(adminPhone.trim())
    setPhoneSaving(false)
    if (error) { setPhoneError(error); return }
    setPhoneSaved(true)
    setTimeout(() => setPhoneSaved(false), 2500)
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Template Pesan WA</h1>
        <p className="text-sm text-muted-foreground">
          Atur pesan WhatsApp yang dikirim ke pasien dan nomor admin utama
        </p>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : (
        <>
          {/* Primary admin phone number */}
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Nomor WhatsApp Admin</h2>
              <p className="text-xs text-muted-foreground">
                Nomor utama yang bisa dihubungi balik oleh pasien, tersedia sebagai placeholder {'{{nomor_admin}}'}
              </p>
            </div>
            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Nomor WhatsApp</label>
                <input
                  type="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {phoneError && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{phoneError}</p>
              )}

              <button
                onClick={handleSavePhone}
                disabled={phoneSaving || !adminPhone.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {phoneSaving ? <Loader2 size={14} className="animate-spin" /> : phoneSaved ? <Check size={14} /> : null}
                {phoneSaving ? 'Menyimpan...' : phoneSaved ? 'Tersimpan' : 'Simpan'}
              </button>
            </div>
          </div>

          {/* Reminder template */}
          <TemplateEditorCard
            title="Pesan Pengingat"
            description="Dikirim ke pasien sebagai pengingat jadwal terapi yang akan berlangsung"
            template={reminderTemplate}
            onChange={setReminderTemplate}
            onSave={handleSaveReminder}
            onReset={() => setReminderTemplate(DEFAULT_REMINDER_TEMPLATE)}
            saving={reminderSaving}
            saved={reminderSaved}
            error={reminderError}
            placeholders={REMINDER_PLACEHOLDERS}
            sampleVars={REMINDER_SAMPLE}
          />

          <Link
            href="/jadwal-harian"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-input hover:bg-muted text-sm font-medium text-foreground transition-colors cursor-pointer"
          >
            <CalendarDays size={15} /> Buka Jadwal Harian
          </Link>

          {/* Order confirmation template */}
          <TemplateEditorCard
            title="Konfirmasi Pendaftaran"
            description="Dikirim ke pasien saat jadwal fisioterapi berhasil didaftarkan"
            template={confirmationTemplate}
            onChange={setConfirmationTemplate}
            onSave={handleSaveConfirmation}
            onReset={() => setConfirmationTemplate(DEFAULT_ORDER_CONFIRMATION_TEMPLATE)}
            saving={confirmationSaving}
            saved={confirmationSaved}
            error={confirmationError}
            placeholders={CONFIRMATION_PLACEHOLDERS}
            sampleVars={CONFIRMATION_SAMPLE}
          />
        </>
      )}
    </div>
  )
}
