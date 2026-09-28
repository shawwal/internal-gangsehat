'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, CalendarDays, Building2, RotateCcw } from 'lucide-react'
import {
  fetchWaConfigAll, saveWaConfig, clearWaConfigOverride,
  type WaConfigAll, type WaConfigKind, type WaConfigSet,
} from '@/app/actions/reminder-template'
import { resolveWaConfig } from '@/lib/waConfig'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/context/ToastContext'
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

type Status = { saving: boolean; saved: boolean; error: string | null }
const IDLE: Status = { saving: false, saved: false, error: null }

// Shown above each editor when a branch is selected: whether the branch uses
// its own value or follows the global default, plus a way back to the default.
function OverrideBar({ overridden, onClear, clearing }: { overridden: boolean; onClear: () => void; clearing: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className={`px-2 py-0.5 rounded-full font-medium ${overridden ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
        {overridden ? 'Khusus cabang ini' : 'Mengikuti default (semua cabang)'}
      </span>
      {overridden && (
        <button type="button" onClick={onClear} disabled={clearing}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-60 cursor-pointer">
          {clearing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Kembalikan ke default
        </button>
      )}
    </div>
  )
}

export default function ReminderTemplatePage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [all, setAll] = useState<WaConfigAll | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchId, setBranchId] = useState<string | null>(null)   // null = default for every branch
  const [draft, setDraft] = useState<WaConfigSet>({ reminder: '', confirmation: '', phone: '' })
  const [status, setStatus] = useState<Record<WaConfigKind, Status>>({ reminder: IDLE, confirmation: IDLE, phone: IDLE })
  const [clearing, setClearing] = useState<WaConfigKind | null>(null)

  const load = useCallback(async () => {
    const cfg = await fetchWaConfigAll()
    setAll(cfg)
    return cfg
  }, [])

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      fetchWaConfigAll(),
      sb.from('branches').select('id, name').eq('is_active', true).order('name'),
    ]).then(([cfg, { data }]) => {
      setAll(cfg)
      setBranches((data ?? []) as { id: string; name: string }[])
      setDraft(cfg.global)
      setLoading(false)
    })
  }, [])

  function selectBranch(id: string | null) {
    setBranchId(id)
    setDraft(id ? resolveWaConfig(all, id) : all!.global)
    setStatus({ reminder: IDLE, confirmation: IDLE, phone: IDLE })
  }

  const overrides = branchId ? all?.byBranch[branchId] ?? {} : {}
  const setKind = (k: WaConfigKind, st: Partial<Status>) => setStatus((s) => ({ ...s, [k]: { ...s[k], ...st } }))

  async function handleSave(kind: WaConfigKind) {
    setKind(kind, { saving: true, saved: false, error: null })
    const value = kind === 'phone' ? draft.phone.trim() : draft[kind]
    const { error } = await saveWaConfig(kind, value, branchId)
    if (error) { setKind(kind, { saving: false, error }); return }
    await load()
    setKind(kind, { saving: false, saved: true })
    setTimeout(() => setKind(kind, { saved: false }), 2500)
  }

  async function handleClear(kind: WaConfigKind) {
    if (!branchId) return
    setClearing(kind)
    const { error } = await clearWaConfigOverride(kind, branchId)
    setClearing(null)
    if (error) { showToast(error, 'error'); return }
    const cfg = await load()
    setDraft((d) => ({ ...d, [kind]: cfg.global[kind] }))
    showToast('Dikembalikan ke template default', 'success')
  }

  const branchName = branches.find((b) => b.id === branchId)?.name
  const overriddenCount = (id: string) => Object.keys(all?.byBranch[id] ?? {}).length

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Template Pesan WA</h1>
        <p className="text-sm text-muted-foreground">
          Atur pesan WhatsApp yang dikirim ke pasien dan nomor admin utama — bisa berbeda per cabang
        </p>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : (
        <>
          {/* Branch picker */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Cabang</h2>
            </div>
            <select
              value={branchId ?? ''}
              onChange={(e) => selectBranch(e.target.value || null)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Default (semua cabang)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{overriddenCount(b.id) ? ` · ${overriddenCount(b.id)} pengaturan khusus` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {branchId
                ? `Perubahan hanya berlaku untuk ${branchName}. Bagian yang tidak diubah tetap mengikuti default.`
                : 'Dipakai oleh semua cabang yang tidak punya pengaturan khusus.'}
            </p>
          </div>

          {/* Primary admin phone number */}
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Nomor WhatsApp Admin</h2>
              <p className="text-xs text-muted-foreground">
                Nomor utama yang bisa dihubungi balik oleh pasien, tersedia sebagai placeholder {'{{nomor_admin}}'}
              </p>
            </div>
            {branchId && <OverrideBar overridden={overrides.phone !== undefined} onClear={() => handleClear('phone')} clearing={clearing === 'phone'} />}
            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Nomor WhatsApp</label>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {status.phone.error && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{status.phone.error}</p>
              )}

              <button
                onClick={() => handleSave('phone')}
                disabled={status.phone.saving || !draft.phone.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {status.phone.saving ? <Loader2 size={14} className="animate-spin" /> : status.phone.saved ? <Check size={14} /> : null}
                {status.phone.saving ? 'Menyimpan...' : status.phone.saved ? 'Tersimpan' : 'Simpan'}
              </button>
            </div>
          </div>

          {/* Reminder template */}
          <div className="space-y-2">
            {branchId && <OverrideBar overridden={overrides.reminder !== undefined} onClear={() => handleClear('reminder')} clearing={clearing === 'reminder'} />}
            <TemplateEditorCard
              title="Pesan Pengingat"
              description="Dikirim ke pasien sebagai pengingat jadwal terapi yang akan berlangsung"
              template={draft.reminder}
              onChange={(v) => setDraft((d) => ({ ...d, reminder: v }))}
              onSave={() => handleSave('reminder')}
              onReset={() => setDraft((d) => ({ ...d, reminder: DEFAULT_REMINDER_TEMPLATE }))}
              saving={status.reminder.saving}
              saved={status.reminder.saved}
              error={status.reminder.error}
              placeholders={REMINDER_PLACEHOLDERS}
              sampleVars={{ ...REMINDER_SAMPLE, ...(branchName ? { cabang: branchName } : {}), ...(draft.phone ? { nomor_admin: draft.phone } : {}) }}
            />
          </div>

          <Link
            href="/jadwal-harian"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-input hover:bg-muted text-sm font-medium text-foreground transition-colors cursor-pointer"
          >
            <CalendarDays size={15} /> Buka Jadwal Harian
          </Link>

          {/* Order confirmation template */}
          <div className="space-y-2">
            {branchId && <OverrideBar overridden={overrides.confirmation !== undefined} onClear={() => handleClear('confirmation')} clearing={clearing === 'confirmation'} />}
            <TemplateEditorCard
              title="Konfirmasi Pendaftaran"
              description="Dikirim ke pasien saat jadwal fisioterapi berhasil didaftarkan"
              template={draft.confirmation}
              onChange={(v) => setDraft((d) => ({ ...d, confirmation: v }))}
              onSave={() => handleSave('confirmation')}
              onReset={() => setDraft((d) => ({ ...d, confirmation: DEFAULT_ORDER_CONFIRMATION_TEMPLATE }))}
              saving={status.confirmation.saving}
              saved={status.confirmation.saved}
              error={status.confirmation.error}
              placeholders={CONFIRMATION_PLACEHOLDERS}
              sampleVars={{ ...CONFIRMATION_SAMPLE, ...(branchName ? { cabang: branchName } : {}), ...(draft.phone ? { nomor_admin: draft.phone } : {}) }}
            />
          </div>
        </>
      )}
    </div>
  )
}
