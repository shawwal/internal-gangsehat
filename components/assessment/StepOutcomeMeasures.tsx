'use client'

import { PROM_OPTIONS } from './types'
import type { AssessmentFormState } from './types'
import type { PromType } from '@/types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function StepOutcomeMeasures({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#34C759]/30 bg-[#34C759]/10 p-3 text-xs text-[#34C759]">
        <strong>HOAC II Rule:</strong> You must have a measurable baseline to prove your treatment worked during reassessment.
        PROMs = patient questionnaires (e.g. LEFS for lower limb, SPADI for shoulder, ODI for back).
        Performance = physical metrics (e.g. Single Leg Hop distance, Grip Strength).
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Patient-Reported Outcome Measure (PROM) Used</label>
          <select
            value={value.prom_used}
            onChange={(e) => onChange({ prom_used: e.target.value as PromType | '' })}
            className={inputCls}
          >
            <option value="">— Pilih —</option>
            {PROM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Baseline Score (Numeric)</label>
          <input
            type="number"
            value={value.prom_baseline_score}
            onChange={(e) => onChange({ prom_baseline_score: e.target.value })}
            placeholder="e.g. 45"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Performance / Functional Metric Test</label>
          <input
            value={value.functional_metric_test}
            onChange={(e) => onChange({ functional_metric_test: e.target.value })}
            placeholder="Single Leg Hop Test, Grip Strength, Y-Balance..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Baseline Result / Value</label>
          <input
            value={value.functional_metric_baseline_value}
            onChange={(e) => onChange({ functional_metric_baseline_value: e.target.value })}
            placeholder="e.g. L: 120cm, R: 85cm"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  )
}
