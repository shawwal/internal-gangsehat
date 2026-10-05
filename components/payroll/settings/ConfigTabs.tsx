'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  addPayrollHoliday, deleteDeductionRule, deletePayrollHoliday, saveActivityType, saveDeductionRule, savePayrollSettings,
  type PayrollSettingsData,
} from '@/app/actions/payrollSettings'
import { WEEKDAY_OPTIONS } from '@/lib/payroll/period'
import type { ActivityType, DeductionRule, Weekday } from '@/lib/payroll/types'
import { CurrencyInput } from '../CurrencyInput'
import { formatRupiah } from '../format'
import { Modal, btn, inputCls, labelCls } from '../Modal'

interface TabProps {
  data: PayrollSettingsData
  onChanged: () => Promise<void>
}

const BASIS_LABEL: Record<DeductionRule['basis'], string> = {
  late_minutes: 'per menit terlambat',
  late_days: 'per hari terlambat',
  alfa_days: 'per hari alfa',
  izin_days: 'per hari izin',
  sakit_days: 'per hari sakit',
}

const SERVICE_TYPES = ['TERAPI AWAL', 'SESI TERAPI', 'PAKET TERAPI', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'LAINNYA']

function ScopeBadge({ branchId }: { branchId: string | null }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${branchId ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
      {branchId ? 'cabang ini' : 'semua cabang'}
    </span>
  )
}

// ── Deduction rules ─────────────────────────────────────────────────────────

type RuleForm = Parameters<typeof saveDeductionRule>[0]

export function RulesTab({ data, onChanged }: TabProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState<RuleForm | null>(null)
  const isDirector = data.role === 'director'
  const canEdit = (branchId: string | null) => isDirector || branchId === data.branchId

  // Branch rows override global rows with the same code.
  const effectiveCodes = new Set(data.deductionRules.filter((r) => r.branch_id).map((r) => r.code))

  async function save() {
    if (!form) return
    const res = await saveDeductionRule(form)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Aturan disimpan', 'success')
    setForm(null)
    await onChanged()
  }

  async function remove(id: string) {
    const res = await deleteDeductionRule(id)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Aturan dihapus', 'success')
    await onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-xl">
          Potongan otomatis dari absensi. Bisa nominal tetap atau persentase gaji pokok per satuan.
          Aturan cabang menggantikan aturan &quot;semua cabang&quot; dengan kode yang sama.
        </p>
        <button className={btn.primary} onClick={() => setForm({
          branch_id: isDirector ? null : data.branchId, code: '', label: '', basis: 'late_minutes', calc_type: 'fixed', amount: 0, is_active: true,
          sort_order: data.deductionRules.length + 1,
        })}><Plus size={14} /> Tambah aturan</button>
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {data.deductionRules.map((r) => {
          const shadowed = !r.branch_id && effectiveCodes.has(r.code)
          return (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${shadowed || !r.is_active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  {r.label} <span className="font-mono text-[10px] text-muted-foreground">{r.code}</span> <ScopeBadge branchId={r.branch_id} />
                  {shadowed && <span className="text-[10px] text-muted-foreground">(digantikan aturan cabang)</span>}
                  {!r.is_active && <span className="text-[10px] text-muted-foreground">(nonaktif)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.calc_type === 'fixed' ? formatRupiah(r.amount) : `${r.amount}% gaji pokok`} {BASIS_LABEL[r.basis]}
                </p>
              </div>
              {canEdit(r.branch_id) && (
                <>
                  <button className={btn.ghost} aria-label="Ubah" onClick={() => setForm({ ...r })}><Pencil size={13} /></button>
                  <button className={btn.ghost} aria-label="Hapus" onClick={() => remove(r.id)}><Trash2 size={13} /></button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {form && (
        <Modal title={form.id ? 'Ubah aturan potongan' : 'Aturan potongan baru'} onClose={() => setForm(null)}
          footer={<><button className={btn.secondary} onClick={() => setForm(null)}>Batal</button><button className={btn.primary} onClick={save}>Simpan</button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Kode</label>
                <input className={inputCls} value={form.code} disabled={!!form.id} placeholder="LATE"
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className={labelCls}>Label di slip</label>
                <input className={inputCls} value={form.label} placeholder="Terlambat" onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Dasar perhitungan</label>
                <select className={inputCls} value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value as DeductionRule['basis'] })}>
                  {Object.entries(BASIS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Jenis</label>
                <select className={inputCls} value={form.calc_type} onChange={(e) => setForm({ ...form, calc_type: e.target.value as DeductionRule['calc_type'] })}>
                  <option value="fixed">Nominal tetap</option>
                  <option value="percent_base">% gaji pokok</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>{form.calc_type === 'fixed' ? 'Nominal per satuan' : 'Persen per satuan'}</label>
              {form.calc_type === 'fixed'
                ? <CurrencyInput value={form.amount} onChange={(amount) => setForm({ ...form, amount })} inputClassName="py-2 rounded-xl" />
                : <input type="number" step="0.1" min={0} max={100} className={inputCls} value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />}
            </div>
            {isDirector && !form.id && (
              <div>
                <label className={labelCls}>Berlaku untuk</label>
                <select className={inputCls} value={form.branch_id ?? ''} onChange={(e) => setForm({ ...form, branch_id: e.target.value || null })}>
                  <option value="">Semua cabang</option>
                  <option value={data.branchId}>Hanya cabang ini</option>
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-[var(--primary)]" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Aktif
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Holidays ────────────────────────────────────────────────────────────────

export function HolidaysTab({ data, onChanged }: TabProps) {
  const { showToast } = useToast()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'branch' | 'all'>(data.role === 'director' ? 'all' : 'branch')
  const isDirector = data.role === 'director'

  async function add() {
    const res = await addPayrollHoliday(scope === 'all' ? null : data.branchId, date, name)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Hari libur ditambahkan', 'success')
    setDate(''); setName('')
    await onChanged()
  }

  async function remove(id: string) {
    const res = await deletePayrollHoliday(id)
    if (!res.ok) return showToast(res.error, 'error')
    await onChanged()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Hari libur otomatis ditandai &quot;libur&quot; saat periode baru dibuka. Untuk periode yang sudah terbuka, ubah langsung di langkah Periode.
      </p>
      <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap items-end gap-2">
        <div>
          <label className={labelCls}>Tanggal</label>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className={labelCls}>Nama</label>
          <input className={inputCls} value={name} placeholder="mis. Hari Kemerdekaan" onChange={(e) => setName(e.target.value)} />
        </div>
        {isDirector && (
          <div>
            <label className={labelCls}>Berlaku</label>
            <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value as 'branch' | 'all')}>
              <option value="all">Semua cabang</option>
              <option value="branch">Cabang ini</option>
            </select>
          </div>
        )}
        <button className={btn.primary} disabled={!date || !name.trim()} onClick={add}><Plus size={14} /> Tambah</button>
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {data.holidays.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada hari libur.</p>}
        {data.holidays.map((h) => (
          <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="font-mono text-xs text-muted-foreground w-24">{h.date}</span>
            <span className="text-sm text-foreground flex-1">{h.name}</span>
            <ScopeBadge branchId={h.branch_id} />
            {(isDirector || h.branch_id === data.branchId) && (
              <button className={btn.ghost} aria-label="Hapus" onClick={() => remove(h.id)}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Activity catalogue ──────────────────────────────────────────────────────

export function ActivityTypesTab({ data, onChanged }: TabProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState<(ActivityType & { isNew?: boolean }) | null>(null)
  const isDirector = data.role === 'director'
  const smLayanan = data.layanan

  async function save() {
    if (!form) return
    const res = await saveActivityType(form)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Aktivitas disimpan', 'success')
    setForm(null)
    await onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-xl">
          Kolom di langkah &quot;Aktivitas & Insentif&quot;. Mode otomatis menghitung dari kunjungan pasien yang hadir;
          untuk Sport Massage pilih layanan (FB / SG) agar terhitung otomatis.
        </p>
        {isDirector && (
          <button className={btn.primary} onClick={() => setForm({
            code: '', label: '', group_label: 'Lainnya', count_mode: 'manual', source_service_types: [], source_layanan_ids: [],
            max_per_period: 100, sort_order: 100, is_active: true, isNew: true,
          })}><Plus size={14} /> Tambah aktivitas</button>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Aktivitas</th>
              <th className="px-3 py-2 text-left font-medium">Kelompok</th>
              <th className="px-3 py-2 text-left font-medium">Sumber</th>
              <th className="px-3 py-2 text-right font-medium">Batas wajar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.activityTypes.map((t) => (
              <tr key={t.code} className={`border-b border-border last:border-0 ${t.is_active ? '' : 'opacity-50'}`}>
                <td className="px-3 py-2"><p className="font-medium text-foreground">{t.label}</p><p className="font-mono text-[10px] text-muted-foreground">{t.code}</p></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{t.group_label}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {t.count_mode === 'manual' ? 'Input manual' : `${t.count_mode === 'package' ? 'Per paket' : 'Per sesi'}: ${t.source_service_types.join(', ')}`}
                  {t.source_layanan_ids.length > 0 && ` (${t.source_layanan_ids.length} layanan)`}
                </td>
                <td className="px-3 py-2 text-right text-xs">{t.max_per_period}</td>
                <td className="px-2">{isDirector && <button className={btn.ghost} aria-label="Ubah" onClick={() => setForm({ ...t })}><Pencil size={13} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.isNew ? 'Aktivitas baru' : form.label} onClose={() => setForm(null)}
          footer={<><button className={btn.secondary} onClick={() => setForm(null)}>Batal</button><button className={btn.primary} onClick={save}>Simpan</button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Kode</label>
                <input className={inputCls} value={form.code} disabled={!form.isNew} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className={labelCls}>Label</label>
                <input className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Kelompok</label>
                <input className={inputCls} value={form.group_label} onChange={(e) => setForm({ ...form, group_label: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Batas wajar per periode</label>
                <input type="number" min={1} className={inputCls} value={form.max_per_period}
                  onChange={(e) => setForm({ ...form, max_per_period: Math.max(1, Math.round(Number(e.target.value))) })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Cara menghitung</label>
              <select className={inputCls} value={form.count_mode} onChange={(e) => setForm({ ...form, count_mode: e.target.value as ActivityType['count_mode'] })}>
                <option value="manual">Input manual oleh HR</option>
                <option value="session">Otomatis — per sesi yang dihadiri</option>
                <option value="package">Otomatis — per paket terjual (sesi pertama)</option>
              </select>
            </div>
            {form.count_mode !== 'manual' && (
              <>
                <div>
                  <label className={labelCls}>Jenis layanan sumber</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICE_TYPES.map((st) => {
                      const on = form.source_service_types.includes(st)
                      return (
                        <button key={st} type="button"
                          onClick={() => setForm({ ...form, source_service_types: on ? form.source_service_types.filter((x) => x !== st) : [...form.source_service_types, st] })}
                          className={`text-xs px-2.5 py-1 rounded-full border ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>{st}</button>
                      )
                    })}
                  </div>
                </div>
                {smLayanan.length > 0 && (
                  <div>
                    <label className={labelCls}>Batasi ke layanan tertentu (opsional)</label>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border p-2 space-y-1">
                      {smLayanan.map((l) => (
                        <label key={l.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" className="accent-[var(--primary)]" checked={form.source_layanan_ids.includes(l.id)}
                            onChange={(e) => setForm({
                              ...form,
                              source_layanan_ids: e.target.checked ? [...form.source_layanan_ids, l.id] : form.source_layanan_ids.filter((x) => x !== l.id),
                            })} />
                          <span className="text-muted-foreground">{l.kategori}</span> · {l.nama}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="accent-[var(--primary)]" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Aktif
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Period & payslip settings ───────────────────────────────────────────────

export function PeriodSettingsTab({ data, onChanged }: TabProps) {
  const { showToast } = useToast()
  const isDirector = data.role === 'director'
  const [scope, setScope] = useState<'branch' | 'global'>(data.settings.scope === 'branch' || !isDirector ? 'branch' : 'global')
  const [form, setForm] = useState({
    period_start_day: data.settings.period_start_day,
    weekly_off_days: data.settings.weekly_off_days,
    rounding_unit: data.settings.rounding_unit,
    max_late_days_warning: data.settings.max_late_days_warning,
    clinic_name: data.settings.clinic_name,
    clinic_address: data.settings.clinic_address,
    clinic_contact: data.settings.clinic_contact,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await savePayrollSettings(scope === 'global' ? null : data.branchId, form)
    setSaving(false)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Pengaturan disimpan — berlaku untuk periode yang dibuka berikutnya', 'success')
    await onChanged()
  }

  const toggleDay = (d: Weekday) => setForm((f) => ({
    ...f, weekly_off_days: f.weekly_off_days.includes(d) ? f.weekly_off_days.filter((x) => x !== d) : [...f.weekly_off_days, d],
  }))

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs text-muted-foreground">
        Sedang dipakai: pengaturan <b>{data.settings.scope === 'branch' ? 'khusus cabang ini' : data.settings.scope === 'global' ? 'semua cabang' : 'bawaan'}</b>.
      </p>
      {isDirector && (
        <div className="flex gap-2">
          {(['branch', 'global'] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${scope === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
              Simpan untuk {s === 'branch' ? 'cabang ini' : 'semua cabang (bawaan)'}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Tanggal mulai periode</label>
            <input type="number" min={1} max={31} className={inputCls} value={form.period_start_day}
              onChange={(e) => setForm({ ...form, period_start_day: Math.min(31, Math.max(1, Math.round(Number(e.target.value)))) })} />
            <p className="text-[10px] text-muted-foreground mt-1">27 = tgl 27 bulan lalu s/d tgl 26 bulan ini</p>
          </div>
          <div>
            <label className={labelCls}>Pembulatan gaji (ke bawah)</label>
            <input type="number" min={1} className={inputCls} value={form.rounding_unit}
              onChange={(e) => setForm({ ...form, rounding_unit: Math.max(1, Math.round(Number(e.target.value))) })} />
          </div>
          <div>
            <label className={labelCls}>Peringatan jika terlambat &gt;</label>
            <input type="number" min={0} className={inputCls} value={form.max_late_days_warning}
              onChange={(e) => setForm({ ...form, max_late_days_warning: Math.max(0, Math.round(Number(e.target.value))) })} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Libur mingguan</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((d) => (
              <button key={d} type="button" onClick={() => toggleDay(d)}
                className={`text-xs px-2.5 py-1 rounded-full border ${form.weekly_off_days.includes(d) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>{d}</button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Kop slip gaji</p>
          <input className={inputCls} value={form.clinic_name} placeholder="Nama klinik" onChange={(e) => setForm({ ...form, clinic_name: e.target.value })} />
          <input className={inputCls} value={form.clinic_address} placeholder="Alamat" onChange={(e) => setForm({ ...form, clinic_address: e.target.value })} />
          <input className={inputCls} value={form.clinic_contact} placeholder="Telepon / email" onChange={(e) => setForm({ ...form, clinic_contact: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <button className={btn.primary} onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
        </div>
      </div>
    </div>
  )
}
