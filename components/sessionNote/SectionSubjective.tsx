'use client'

import { RangeSlider } from '@/components/ui/RangeSlider'
import { RichTextEditor } from '@/components/assessment/RichTextEditor'
import { SYMPTOM_TREND_LABEL, SYMPTOM_TREND_OPTIONS } from './types'
import type { SessionNoteFormState } from './types'
import type { SymptomTrend } from '@/types'

interface Props {
  value: SessionNoteFormState
  onChange: (patch: Partial<SessionNoteFormState>) => void
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function SectionSubjective({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-muted/40 border-y border-border">
        <h3 className="text-sm font-semibold text-foreground">1. Subjective (Laporan Pasien)</h3>
      </div>

      <div>
        <label className={labelCls}>Skala Nyeri Saat Ini (0–10)</label>
        <RangeSlider
          value={value.pain_scale}
          onChange={(v) => onChange({ pain_scale: v })}
          min={0}
          max={10}
          gradient
          minLabel="Tidak Nyeri"
          maxLabel="Nyeri Terparah"
        />
      </div>

      <div>
        <label className={labelCls}>Sejak Sesi Terakhir, Gejala:</label>
        <select
          value={value.symptom_trend}
          onChange={(e) => onChange({ symptom_trend: e.target.value as SymptomTrend | '' })}
          className={inputCls}
        >
          <option value="">— Pilih —</option>
          {SYMPTOM_TREND_OPTIONS.map((t) => <option key={t} value={t}>{SYMPTOM_TREND_LABEL[t]}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Catatan (Faktor Memperberat/Meringankan, keterbatasan spesifik olahraga)</label>
        <RichTextEditor
          value={value.subjective_notes}
          onChange={(html) => onChange({ subjective_notes: html })}
        />
      </div>
    </div>
  )
}
