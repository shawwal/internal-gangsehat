'use client'

import { RichTextEditor } from '@/components/assessment/RichTextEditor'
import { TREATMENTS_PERFORMED_LABEL, TREATMENTS_PERFORMED_OPTIONS } from './types'
import type { SessionNoteFormState } from './types'
import type { TreatmentPerformed } from '@/types'

interface Props {
  value: SessionNoteFormState
  onChange: (patch: Partial<SessionNoteFormState>) => void
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function SectionPlan({ value, onChange }: Props) {
  function toggleTreatment(t: TreatmentPerformed) {
    const next = value.treatments_performed.includes(t)
      ? value.treatments_performed.filter((x) => x !== t)
      : [...value.treatments_performed, t]
    onChange({ treatments_performed: next })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-muted/40 border-y border-border">
        <h3 className="text-sm font-semibold text-foreground">4. Plan &amp; Intervensi Hari Ini</h3>
      </div>

      <div>
        <label className={labelCls}>Tindakan yang Dilakukan (Centang semua yang sesuai)</label>
        <div className="flex flex-wrap gap-3">
          {TREATMENTS_PERFORMED_OPTIONS.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={value.treatments_performed.includes(t)}
                onChange={() => toggleTreatment(t)}
                className="rounded border-border accent-primary"
              />
              {TREATMENTS_PERFORMED_LABEL[t]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Home Exercise Program (HEP) yang Diberikan</label>
        <RichTextEditor
          value={value.hep_given}
          onChange={(html) => onChange({ hep_given: html })}
          placeholder="Contoh: 3x15 Clamshells, Peregangan Hamstring harian"
        />
      </div>

      <div>
        <label className={labelCls}>Plan untuk Sesi Berikutnya / Timeline Kembali Berlatih</label>
        <input
          value={value.next_plan}
          onChange={(e) => onChange({ next_plan: e.target.value })}
          className={inputCls}
        />
      </div>
    </div>
  )
}
