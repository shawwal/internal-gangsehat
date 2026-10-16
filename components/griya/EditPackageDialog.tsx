'use client'

import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { updatePatientPackage, deletePatientPackage } from '@/app/actions/packages'
import { stopGriyaPackage } from '@/app/actions/griyaPackages'
import type { PatientPackage } from '@/types'
import { ModalPortal } from '@/components/payment-links/ModalPortal'
import { PACKAGE_CATEGORIES } from '@/lib/serviceType'
import { inputCls, labelCls } from './StudentFormFields'

const STATUS_OPTIONS: { value: PatientPackage['status']; label: string }[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'completed', label: 'Selesai' },
  { value: 'stopped', label: 'Dihentikan' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

const COMPLETION_OPTIONS = ['LANJUT', 'SEMBUH', 'TIDAK LANJUT', 'STOP'] as const

interface Props {
  pkg: PatientPackage
  onClose: () => void
  onSaved: () => void
}

export function EditPackageDialog({ pkg, onClose, onSaved }: Props) {
  const [name, setName] = useState(pkg.package_name)
  const [total, setTotal] = useState(String(pkg.total_sessions))
  const [legacy, setLegacy] = useState(String(pkg.legacy_used_sessions))
  const [status, setStatus] = useState<PatientPackage['status']>(pkg.status)
  const [notes, setNotes] = useState(pkg.notes ?? '')
  const [purchasedAt, setPurchasedAt] = useState(pkg.purchased_at?.slice(0, 10) ?? '')
  const [mulai, setMulai] = useState<NonNullable<PatientPackage['mulai_paket']> | ''>(pkg.mulai_paket ?? '')
  const [category, setCategory] = useState<PatientPackage['category']>(pkg.category)
  const [completion, setCompletion] = useState<PatientPackage['completion_status']>(pkg.completion_status)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalNum = Number(total) || 0
  const legacyNum = Number(legacy) || 0
  // Attended count, not payment-gated used_sessions (0 while unpaid).
  const inApp = Math.max(0, (pkg.attended_sessions ?? pkg.used_sessions) - pkg.legacy_used_sessions)
  const previewRemaining = totalNum - legacyNum - inApp

  async function save() {
    if (totalNum < 1) { setError('Total sesi minimal 1.'); return }
    if (legacyNum < 0) { setError('Sesi terpakai tidak boleh negatif.'); return }
    setSaving(true); setError(null)
    // Stopping an active package also unlinks it from its recurring slots.
    const stopping = pkg.status === 'active' && status === 'stopped'
    if (stopping) {
      const { error } = await stopGriyaPackage(pkg.id)
      if (error) { setSaving(false); setError(error); return }
    }
    const { error } = await updatePatientPackage(pkg.id, {
      package_name: name.trim() || pkg.package_name,
      // Only send the size when it changed — it clears the P1/P2 label.
      ...(totalNum !== pkg.total_sessions && { total_sessions: totalNum }),
      legacy_used_sessions: legacyNum,
      ...(!stopping && { status }),
      notes: notes.trim() || null,
      ...(purchasedAt && { purchased_at: purchasedAt }),
      ...(mulai && { mulai_paket: mulai }),
      ...(category && { category }),
      completion_status: completion,
    })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  async function remove() {
    if (!confirm(`Hapus paket "${pkg.package_name}"? Jika sudah ada riwayat, paket hanya dibatalkan.`)) return
    setDeleting(true); setError(null)
    const { error } = await deletePatientPackage(pkg.id)
    setDeleting(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="glass-card w-full max-w-md max-h-[88vh] flex flex-col p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Ubah Paket</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            <div>
              <label className={labelCls}>Nama Paket</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Total Sesi Dibeli</label>
                <input type="number" min={1} value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sesi Terpakai di Luar Sistem</label>
                <input type="number" min={0} value={legacy} onChange={(e) => setLegacy(e.target.value)} className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Untuk sesi yang sudah dipakai sebelum tercatat di aplikasi.
            </p>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 text-sm">
              <span className="text-muted-foreground">Sesi tercatat di aplikasi</span>
              <span className="font-medium text-foreground">{inApp}</span>
            </div>
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium ${
              previewRemaining <= 0 ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-[#34C759]/10 text-[#34C759]'
            }`}>
              <span>Tersisa</span>
              <span>{previewRemaining} sesi</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tanggal Beli</label>
                <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mulai Paket</label>
                <select value={mulai} onChange={(e) => setMulai(e.target.value as typeof mulai)} className={inputCls}>
                  {!pkg.mulai_paket && <option value="">—</option>}
                  <option value="NEW">NEW (baru)</option>
                  <option value="EXT.">EXT. (perpanjangan)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Kategori</label>
                <select value={category ?? ''} onChange={(e) => setCategory((e.target.value || null) as PatientPackage['category'])} className={inputCls}>
                  {!pkg.category && <option value="">—</option>}
                  {PACKAGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as PatientPackage['status'])} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Hasil Akhir</label>
              <select value={completion ?? ''} onChange={(e) => setCompletion((e.target.value || null) as PatientPackage['completion_status'])} className={inputCls}>
                <option value="">— Belum ditentukan</option>
                {COMPLETION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Catatan</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex items-center gap-2 pt-4">
            <button onClick={remove} disabled={deleting || saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-60 cursor-pointer">
              <Trash2 size={14} /> {deleting ? '...' : 'Hapus'}
            </button>
            <div className="flex-1" />
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
            <button onClick={save} disabled={saving || deleting}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
