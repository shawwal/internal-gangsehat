'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { updateVisit } from '@/app/actions/jadwal'
import { RegionSelect } from '@/components/ui/RegionSelect'
import type { BodyRegion } from '@/types'

const BODY_REGIONS: BodyRegion[] = [
  'HEAD', 'NECK', 'SHOULDER', 'UPPER ARM', 'ELBOW', 'LOWER ARM',
  'WRIST', 'HAND', 'SPINE', 'CHEST', 'UPPER BACK', 'LOWER BACK',
  'ABDOMINAL', 'HIP/PELVIC', 'THIGH', 'KNEE', 'CALF', 'ANKLE',
  'FOOT', 'CNS', 'PNS', 'SYSTEMIC', 'CARDIOVASCULAR', 'PULMONAL', 'PERFORMANCE',
]

export interface VisitInfoState {
  shift: string
  kehadiran: string
  regio: string
  sumber_pasien: string
}

interface Props {
  visitId: string
  value: VisitInfoState
  onChange: (next: VisitInfoState) => void
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1'

export function VisitInfoBar({ visitId, value, onChange }: Props) {
  const [saved, setSaved] = useState(false)

  async function persist(next: VisitInfoState) {
    setSaved(false)
    const { error } = await updateVisit(visitId, {
      shift:         next.shift || null,
      kehadiran:     next.kehadiran || null,
      regio:         next.regio || null,
      sumber_pasien: next.sumber_pasien || null,
    })
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  function set(key: keyof VisitInfoState, v: string) {
    const next = { ...value, [key]: v }
    onChange(next)
    return next
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground">Info Kunjungan</p>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] text-[#34C759]">
            <Check size={11} /> Tersimpan
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Shift</label>
          <select
            value={value.shift}
            onChange={(e) => persist(set('shift', e.target.value))}
            className={inputCls}
          >
            <option value="">— Pilih —</option>
            <option value="PAGI">PAGI</option>
            <option value="SORE">SORE</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Kehadiran</label>
          <select
            value={value.kehadiran}
            onChange={(e) => persist(set('kehadiran', e.target.value))}
            className={inputCls}
          >
            <option value="">— Pilih —</option>
            <option value="HADIR">HADIR</option>
            <option value="TIDAK HADIR">TIDAK HADIR</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Regio</label>
          <RegionSelect
            options={BODY_REGIONS}
            value={value.regio}
            onChange={(v) => persist(set('regio', v))}
          />
        </div>
        <div>
          <label className={labelCls}>Sumber Pasien</label>
          <input
            value={value.sumber_pasien}
            onChange={(e) => set('sumber_pasien', e.target.value)}
            onBlur={() => persist(value)}
            placeholder="mis. Rekomendasi, sosial media"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  )
}
