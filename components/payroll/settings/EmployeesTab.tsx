'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight, History, Trash2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  addCompensationVersion, deleteCompensationVersion, saveEmployeePayrollProfile, type EmployeeRow, type PayrollSettingsData,
} from '@/app/actions/payrollSettings'
import type { Compensation } from '@/lib/payroll/types'
import { formatIDR, formatRupiah } from '../format'
import { Modal, btn, inputCls, labelCls } from '../Modal'
import { CompensationEditor, EMPTY_COMPENSATION } from './CompensationEditor'

interface Props {
  data: PayrollSettingsData
  onChanged: () => Promise<void>
}

const today = () => new Date().toISOString().slice(0, 10)

export function EmployeesTab({ data, onChanged }: Props) {
  const { showToast } = useToast()
  const [open, setOpen] = useState<EmployeeRow | null>(null)
  const [tab, setTab] = useState<'profile' | 'comp' | 'history'>('comp')
  const [profile, setProfile] = useState({ employee_no: '', jabatan: '', hire_date: '', termination_date: '', include_in_payroll: true })
  const [comp, setComp] = useState<Compensation>(EMPTY_COMPENSATION)
  const [effectiveFrom, setEffectiveFrom] = useState(today())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function openEmployee(e: EmployeeRow) {
    setOpen(e)
    setTab(e.employee_no ? 'comp' : 'profile')
    setProfile({
      employee_no: e.employee_no ?? '', jabatan: e.jabatan ?? '', hire_date: e.hire_date ?? '',
      termination_date: e.termination_date ?? '', include_in_payroll: e.include_in_payroll,
    })
    const current = e.versions[0]
    if (current) {
      setComp({
        gaji_pokok: current.gaji_pokok, tj_jabatan: current.tj_jabatan, operasional: current.operasional,
        operasional_mode: current.operasional_mode, operasional_threshold: current.operasional_threshold,
        operasional_daily_rate: current.operasional_daily_rate, insentif_base: current.insentif_base,
        incentive_target: current.incentive_target, incentive_activity_codes: current.incentive_activity_codes,
        bonus_tiers: current.bonus_tiers, activity_rates: current.activity_rates,
      })
    } else {
      setComp(EMPTY_COMPENSATION)
    }
    setEffectiveFrom(today())
    setNotes('')
  }

  async function saveProfile() {
    if (!open) return
    setSaving(true)
    const res = await saveEmployeePayrollProfile(open.id, {
      employee_no: profile.employee_no || null, jabatan: profile.jabatan || null,
      hire_date: profile.hire_date || null, termination_date: profile.termination_date || null,
      include_in_payroll: profile.include_in_payroll,
    })
    setSaving(false)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Data karyawan disimpan', 'success')
    await onChanged()
  }

  async function saveComp() {
    if (!open) return
    setSaving(true)
    const res = await addCompensationVersion(open.id, effectiveFrom, comp, notes)
    setSaving(false)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Versi kompensasi baru disimpan', 'success')
    setOpen(null)
    await onChanged()
  }

  async function removeVersion(id: string) {
    const res = await deleteCompensationVersion(id)
    if (!res.ok) return showToast(res.error, 'error')
    showToast('Versi dihapus', 'success')
    setOpen(null)
    await onChanged()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pengganti sheet <b>ID</b>. Perubahan gaji/tarif disimpan sebagai <b>versi baru</b> dengan tanggal berlaku —
        periode yang sudah dikunci tetap memakai angka lama.
      </p>
      <div className="rounded-2xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">No. Karyawan</th>
              <th className="px-3 py-2 text-left font-medium">Nama</th>
              <th className="px-3 py-2 text-left font-medium">Jabatan</th>
              <th className="px-3 py-2 text-right font-medium">Gaji Pokok</th>
              <th className="px-3 py-2 text-right font-medium">Operasional</th>
              <th className="px-3 py-2 text-right font-medium">Insentif</th>
              <th className="px-3 py-2 text-left font-medium">Berlaku</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.employees.map((e) => {
              const v = e.versions[0]
              return (
                <tr key={e.id} onClick={() => openEmployee(e)} className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer ${e.is_active ? '' : 'opacity-50'}`}>
                  <td className="px-3 py-2 font-mono text-xs">{e.employee_no ?? <span className="text-destructive">belum ada</span>}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{e.full_name}</p>
                    {!e.include_in_payroll && <p className="text-[10px] text-muted-foreground">tidak diikutkan penggajian</p>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.jabatan ?? '—'}</td>
                  {v ? (
                    <>
                      <td className="px-3 py-2 text-right">{formatIDR(v.gaji_pokok)}</td>
                      <td className="px-3 py-2 text-right">{v.operasional_mode === 'daily_deduction' ? 'per hari' : formatIDR(v.operasional)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatIDR(v.insentif_base)}
                        {v.incentive_target > 0 && <span className="text-[10px] text-muted-foreground"> / {v.incentive_target}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{v.effective_from === '2000-01-01' ? 'awal' : v.effective_from}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="px-3 py-2 text-xs text-destructive">
                      <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> Kompensasi belum diisi</span>
                    </td>
                  )}
                  <td className="px-2 text-muted-foreground"><ChevronRight size={14} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={open.full_name} subtitle={open.employee_no ?? 'Belum ada no. karyawan'} onClose={() => setOpen(null)} size="lg"
          footer={
            tab === 'profile' ? (
              <button className={btn.primary} onClick={saveProfile} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan data karyawan'}</button>
            ) : tab === 'comp' ? (
              <button className={btn.primary} onClick={saveComp} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan sebagai versi baru'}</button>
            ) : undefined
          }>
          <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit mb-4">
            {([['profile', 'Data karyawan'], ['comp', 'Kompensasi'], ['history', `Riwayat (${open.versions.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === k ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:bg-muted'}`}>{l}</button>
            ))}
          </div>

          {tab === 'profile' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>No. karyawan (unik)</label>
                <input className={inputCls} value={profile.employee_no} placeholder="mis. B1220101"
                  onChange={(e) => setProfile({ ...profile, employee_no: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className={labelCls}>Jabatan</label>
                <input className={inputCls} value={profile.jabatan} placeholder="FISIOTERAPIS" list="jabatan-options"
                  onChange={(e) => setProfile({ ...profile, jabatan: e.target.value.toUpperCase() })} />
                <datalist id="jabatan-options">
                  {['FISIOTERAPIS', 'MASSEUR', 'STAF ADMINISTRASI', 'STAF ADMINISTRASI PUSAT', 'STAF HR'].map((j) => <option key={j} value={j} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Tanggal masuk</label>
                <input type="date" className={inputCls} value={profile.hire_date} onChange={(e) => setProfile({ ...profile, hire_date: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Tanggal berhenti</label>
                <input type="date" className={inputCls} value={profile.termination_date} onChange={(e) => setProfile({ ...profile, termination_date: e.target.value })} />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[var(--primary)]" checked={profile.include_in_payroll}
                  onChange={(e) => setProfile({ ...profile, include_in_payroll: e.target.checked })} />
                Ikutkan otomatis saat periode penggajian dibuka
              </label>
            </div>
          )}

          {tab === 'comp' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
                <div>
                  <label className={labelCls}>Berlaku mulai</label>
                  <input type="date" className={inputCls} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Dipakai untuk periode yang berakhir pada/setelah tanggal ini.</p>
                </div>
                <div>
                  <label className={labelCls}>Catatan perubahan</label>
                  <input className={inputCls} value={notes} placeholder="mis. Kenaikan gaji pokok 2026" onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <CompensationEditor value={comp} onChange={setComp} activityTypes={data.activityTypes.filter((t) => t.is_active)} />
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {open.versions.length === 0 && <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>}
              {open.versions.map((v, i) => (
                <div key={v.id} className="rounded-xl border border-border p-3 flex items-start gap-3">
                  <History size={14} className={i === 0 ? 'text-primary mt-0.5' : 'text-muted-foreground mt-0.5'} />
                  <div className="flex-1 text-xs space-y-0.5">
                    <p className="font-semibold text-foreground">
                      Berlaku {v.effective_from === '2000-01-01' ? 'sejak awal' : v.effective_from} {i === 0 && <span className="text-primary">(terbaru)</span>}
                    </p>
                    <p className="text-muted-foreground">
                      Pokok {formatRupiah(v.gaji_pokok)} · Tj. jabatan {formatRupiah(v.tj_jabatan)} · Operasional {
                        v.operasional_mode === 'daily_deduction' ? `${formatRupiah(v.operasional_daily_rate)}/hari` : formatRupiah(v.operasional)
                      } · Insentif {formatRupiah(v.insentif_base)}{v.incentive_target ? ` (target ${v.incentive_target})` : ''}
                    </p>
                    {v.notes && <p className="text-muted-foreground italic">{v.notes}</p>}
                  </div>
                  <button className={btn.ghost} aria-label="Hapus versi" onClick={() => removeVersion(v.id)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
