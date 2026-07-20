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

const SUMBER_PASIEN_OPTIONS = [
  'Rekomendasi orang lain',
  'Pasien lama',
  'Media sosial',
  'Pencarian Google',
  'Iklan/ads',
  'Event',
  'Rujukan dokter',
  'Lainnya',
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

  const knownOptions = SUMBER_PASIEN_OPTIONS.filter((o) => o !== 'Lainnya')
  const isCustomSumber = value.sumber_pasien !== '' && !knownOptions.includes(value.sumber_pasien)
  const sumberSelectValue = isCustomSumber ? 'Lainnya' : value.sumber_pasien

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <select
            value={sumberSelectValue}
            onChange={(e) => {
              const v = e.target.value
              persist(set('sumber_pasien', v === 'Lainnya' ? '' : v))
            }}
            className={inputCls}
          >
            <option value="">— Pilih —</option>
            {SUMBER_PASIEN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {sumberSelectValue === 'Lainnya' && (
            <input
              value={value.sumber_pasien}
              onChange={(e) => set('sumber_pasien', e.target.value)}
              onBlur={() => persist(value)}
              placeholder="Sebutkan sumber pasien"
              className={`${inputCls} mt-2`}
              autoFocus
            />
          )}
        </div>
      </div>
    </div>
  )
}
