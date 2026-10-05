'use client'

import { useMemo, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import type { LayananRow } from '@/app/actions/layanan'
import { createPackageFromLayanan } from '@/app/actions/packages'
import { startGriyaPackage } from '@/app/actions/griyaPackages'
import type { GriyaStudentSlot } from '@/app/actions/griyaStudents'
import type { Discipline, Hari } from '@/app/actions/griyaJadwal'
import type { PatientPackage } from '@/types'
import { LayananPicker } from '@/components/jadwal/assign/paket/LayananPicker'
import { PaketPaymentStep } from '@/components/jadwal/assign/paket/PaketPaymentStep'
import { DISCIPLINE_LABEL, HARI_LABEL } from './constants'
import { inputCls, labelCls } from './StudentFormFields'

interface Props {
  patientId: string
  patientName: string
  branchId: string
  /** The child's active recurring slots. When given, the new package is put on
   *  the chosen discipline's slots (replacing the package there) — omit to only
   *  create the package (e.g. AssignStudentDialog picks it for one booking). */
  slots?: GriyaStudentSlot[]
  packages?: PatientPackage[]
  onClose: () => void
  /** Fired once the package row exists (payment may still be pending). */
  onDone: (packageId: string) => void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function GriyaBuyPackageDialog({ patientId, patientName, branchId, slots, packages, onClose, onDone }: Props) {
  const [layanan, setLayanan] = useState<LayananRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; layanan: LayananRow } | null>(null)

  // Active slots grouped by discipline — a package covers all of a discipline's slots.
  const groups = useMemo(() => {
    const map = new Map<string, GriyaStudentSlot[]>()
    for (const s of slots ?? []) {
      if (s.status !== 'active') continue
      map.set(s.discipline, [...(map.get(s.discipline) ?? []), s])
    }
    return [...map.entries()]
  }, [slots])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(groups.length === 1 ? [groups[0][0]] : []))
  const [fromDate, setFromDate] = useState(todayIso())
  const [carryOver, setCarryOver] = useState(false)
  const [usedSessions, setUsedSessions] = useState('0')

  const pkgName = (id: string | null) => (id ? packages?.find((p) => p.id === id)?.package_name ?? 'Paket' : null)
  const pickedSlots = groups.filter(([d]) => picked.has(d)).flatMap(([, ss]) => ss)
  const replaced = [...new Set(pickedSlots.map((s) => s.package_id).filter((p): p is string => !!p))]
  const maxSessions = layanan?.jumlah_sesi ?? 1
  const usedNum = Number(usedSessions) || 0

  function toggle(d: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  async function createPkg() {
    if (!layanan) return
    if (slots && pickedSlots.length === 0 && groups.length > 0) { setError('Pilih jadwal yang memakai paket ini.'); return }
    if (carryOver && (usedNum < 0 || usedNum >= maxSessions)) {
      setError(`Sesi sudah terpakai harus 0–${maxSessions - 1}.`); return
    }
    setCreating(true); setError(null)
    const category = layanan.kategori.includes('VISIT') ? 'PAKET VISIT' : 'PAKET KLINIK'
    const { id, error } = await createPackageFromLayanan({
      patient_id: patientId, branch_id: branchId, layanan_id: layanan.id, category,
      ...(carryOver && { carry_over: { used_sessions: usedNum } }),
    })
    if (error || !id) { setCreating(false); setError(error ?? 'Gagal membuat paket.'); return }

    if (pickedSlots.length > 0) {
      const res = await startGriyaPackage({ packageId: id, slotIds: pickedSlots.map((s) => s.id), fromDate })
      if (res.error) { setCreating(false); setError(`Paket dibuat, tapi gagal dipasang ke jadwal: ${res.error}`); return }
    }
    setCreating(false)
    // Carried-over packages were already paid in the old system.
    if (carryOver) { onDone(id); return }
    setCreated({ id, layanan })
  }

  if (created) {
    return (
      <PaketPaymentStep
        patientId={patientId}
        patientName={patientName}
        packageId={created.id}
        packageName={created.layanan.nama}
        jumlahSesi={created.layanan.jumlah_sesi ?? 1}
        hargaDefault={created.layanan.harga}
        category={created.layanan.kategori.includes('VISIT') ? 'PAKET VISIT' : 'PAKET KLINIK'}
        branchId={branchId}
        onDone={() => onDone(created.id)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Beli Paket — {patientName.split(' ')[0]}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Pilih paket dari daftar layanan cabang.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        <LayananPicker branchId={branchId} selected={layanan} onSelect={setLayanan} />

        {slots && (
          <div className="mt-4 space-y-3">
            <div>
              <label className={labelCls}>Berlaku untuk jadwal</label>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada jadwal rutin aktif — paket hanya dicatat.</p>
              ) : (
                <div className="space-y-1.5">
                  {groups.map(([d, ss]) => {
                    const current = [...new Set(ss.map((s) => pkgName(s.package_id)))]
                    return (
                      <label key={d} className="flex items-start gap-2 px-3 py-2 rounded-xl border border-border text-sm cursor-pointer hover:bg-muted/40">
                        <input type="checkbox" checked={picked.has(d)} onChange={() => toggle(d)} className="mt-0.5" />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-foreground">{DISCIPLINE_LABEL[d as Discipline] ?? d}</span>
                          <span className="block text-xs text-muted-foreground">
                            {ss.map((s) => `${HARI_LABEL[s.hari as Hari] ?? s.hari} ${s.slot_time}`).join(', ')}
                            {' · '}{current.map((c) => c ?? 'Tanpa paket').join(', ')}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {groups.length > 0 && (
              <div>
                <label className={labelCls}>Berlaku mulai</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Kunjungan di jadwal terpilih mulai tanggal ini dihitung ke paket baru (Pertemuan Ke-1 dst.).
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} />
              Lanjutan dari sistem lama (sudah dibayar)
            </label>
            {carryOver && (
              <div>
                <label className={labelCls}>Sesi sudah terpakai di sistem lama</label>
                <input type="number" min={0} max={maxSessions - 1} value={usedSessions}
                  onChange={(e) => setUsedSessions(e.target.value)} className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Pertemuan berikutnya dihitung mulai Ke-{usedNum + 1}. Tidak perlu input pembayaran.
                </p>
              </div>
            )}

            {replaced.length > 0 && (
              <p className="flex gap-1.5 text-xs text-[#FFB35C]">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                Paket {replaced.map((id) => `"${pkgName(id)}"`).join(', ')} akan dihentikan dan diganti paket ini.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          <button onClick={createPkg} disabled={!layanan || creating}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
            {creating ? 'Membuat...' : carryOver ? 'Simpan paket' : 'Lanjut ke pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}
