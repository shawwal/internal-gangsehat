'use client'

// The "Fisio" field on every form that records income. The value becomes
// `transactions.fisio_id` — the therapist the sale counts for on finance,
// Progress Target and PFOTM. Defaults to `preferredStaffId` (e.g. the slot's
// therapist) or else the patient's last therapist; never overrides a choice.

import { useEffect, useState } from 'react'
import { getSaleFisioDefaults } from '@/app/actions/dataCheck'
import type { TherapistOption } from '@/lib/finance/therapists'

interface Props {
  patientId: string | null
  branchId: string | null
  value: string
  onChange: (staffId: string) => void
  required?: boolean
  /** Known therapist for this sale (slot / visit) — wins over the last-therapist suggestion. */
  preferredStaffId?: string | null
  selectClassName?: string
  labelClassName?: string
}

const DEFAULT_SELECT = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const DEFAULT_LABEL = 'block text-xs font-medium text-foreground mb-1.5'

export function FisioSelect({
  patientId, branchId, value, onChange, required = false, preferredStaffId, selectClassName, labelClassName,
}: Props) {
  const [options, setOptions] = useState<TherapistOption[] | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSaleFisioDefaults(patientId ?? '', branchId).then((res) => {
      if (cancelled) return
      if (!res.ok) { setOptions([]); return }
      const { therapists, suggestion } = res.data
      const extra = suggestion && !therapists.some((t) => t.id === suggestion.staffId)
        ? [{ id: suggestion.staffId, name: suggestion.name, inactive: false }] : []
      setOptions([...therapists, ...extra])
      const preferred = preferredStaffId && therapists.some((t) => t.id === preferredStaffId) ? preferredStaffId : null
      setHint(preferred
        ? 'Terapis jadwal ini — ubah bila penjualnya fisio lain.'
        : suggestion ? `Terakhir menangani pasien: ${suggestion.name} (${suggestion.visitDate})` : null)
      const pick = preferred ?? suggestion?.staffId
      if (pick && !value) onChange(pick)
    })
    return () => { cancelled = true }
    // `value` / `onChange` deliberately excluded: only (re)fill on a new patient / branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, branchId, preferredStaffId])

  return (
    <div>
      <label className={labelClassName ?? DEFAULT_LABEL}>
        Fisio {required && <span className="text-destructive">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={options === null}
        className={selectClassName ?? DEFAULT_SELECT}
        aria-label="Fisio"
      >
        <option value="">{options === null ? 'Memuat…' : required ? 'Pilih Fisio…' : '— Tidak ditentukan —'}</option>
        {(options ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <p className="text-[11px] text-muted-foreground mt-1">
        {hint ?? 'Penjualan dihitung ke Fisio ini (PFOTM, Progress Target, laporan per terapis).'}
      </p>
    </div>
  )
}

/** Income categories that must carry a Fisio. */
export { isTherapistCategory } from '@/lib/finance/dataCheck'
