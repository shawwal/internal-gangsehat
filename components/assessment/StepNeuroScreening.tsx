'use client'

import {
  DERMATOME_STATUS_LABEL, DERMATOME_STATUS_OPTIONS,
  MYOTOME_STATUS_LABEL, MYOTOME_STATUS_OPTIONS,
  REFLEX_STATUS_LABEL, REFLEX_STATUS_OPTIONS,
} from './types'
import type { AssessmentFormState } from './types'
import type { DermatomeStatus, MyotomeStatus, ReflexStatus } from '@/types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'
const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed'

const NO_NEURO_STATE = {
  dermatomes_status: 'NotTested' as DermatomeStatus,
  myotomes_status: 'NotTested' as MyotomeStatus,
  reflexes_status: 'NotTested' as ReflexStatus,
  dermatomes_notes: '',
  myotomes_notes: '',
  reflexes_notes: '',
}

function legacyBanner(label: string, text: string | null) {
  if (!text) return null
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300 mb-2">
      <strong>Catatan lama {label} (pre-migrasi, read-only):</strong> {text}
    </div>
  )
}

export function StepNeuroScreening({ value, onChange }: Props) {
  const noNeuro = value.dermatomes_status === 'NotTested'
    && value.myotomes_status === 'NotTested'
    && value.reflexes_status === 'NotTested'
    && !value.dermatomes_notes && !value.myotomes_notes && !value.reflexes_notes

  function toggleNoNeuro() {
    onChange(noNeuro ? {
      dermatomes_status: '', myotomes_status: '', reflexes_status: '',
    } : NO_NEURO_STATE)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        <strong>When to perform:</strong> Patient reports spinal pain, radiating pain, numbness, tingling, or weakness. Test bilaterally.
        Dermatomes: L4 (medial ankle), L5 (dorsum of foot), S1 (lateral heel/foot). Reflexes (DTR): 0=Absent, 1+=Diminished, 2+=Normal, 3+=Hyperactive, 4+=Clonus.
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={noNeuro}
          onChange={toggleNoNeuro}
          className="rounded border-border accent-primary"
        />
        <b>Tidak Ada Gejala Neurologis</b>
      </label>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Dermatom (Sensorik)</label>
          <select
            value={value.dermatomes_status}
            onChange={(e) => onChange({ dermatomes_status: e.target.value as DermatomeStatus | '' })}
            disabled={noNeuro}
            className={inputCls}
          >
            <option value="">— Pilih —</option>
            {DERMATOME_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{DERMATOME_STATUS_LABEL[o]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Miotom (Motorik)</label>
          <select
            value={value.myotomes_status}
            onChange={(e) => onChange({ myotomes_status: e.target.value as MyotomeStatus | '' })}
            disabled={noNeuro}
            className={inputCls}
          >
            <option value="">— Pilih —</option>
            {MYOTOME_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{MYOTOME_STATUS_LABEL[o]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Refleks</label>
          <select
            value={value.reflexes_status}
            onChange={(e) => onChange({ reflexes_status: e.target.value as ReflexStatus | '' })}
            disabled={noNeuro}
            className={inputCls}
          >
            <option value="">— Pilih —</option>
            {REFLEX_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{REFLEX_STATUS_LABEL[o]}</option>)}
          </select>
        </div>
      </div>

      <div>
        {legacyBanner('Dermatom', value.dermatomes_sensory)}
        <label className={labelCls}>Catatan Dermatom (Sensorik)</label>
        <textarea
          value={value.dermatomes_notes}
          onChange={(e) => onChange({ dermatomes_notes: e.target.value })}
          disabled={noNeuro}
          placeholder="e.g. Decreased sensation to light touch at L5 dermatome on the right..."
          rows={2}
          className={inputCls}
        />
      </div>

      <div>
        {legacyBanner('Miotom', value.myotomes_motor)}
        <label className={labelCls}>Catatan Miotom (Motorik)</label>
        <textarea
          value={value.myotomes_notes}
          onChange={(e) => onChange({ myotomes_notes: e.target.value })}
          disabled={noNeuro}
          placeholder="e.g. EHL (L5) weakness 3/5 on the right, fatigues quickly..."
          rows={2}
          className={inputCls}
        />
      </div>

      <div>
        {legacyBanner('Refleks', value.reflexes_neural_tension)}
        <label className={labelCls}>Catatan Refleks &amp; Neural Tension</label>
        <textarea
          value={value.reflexes_notes}
          onChange={(e) => onChange({ reflexes_notes: e.target.value })}
          disabled={noNeuro}
          placeholder="e.g. Patellar 2+ bilateral. SLR (+) on right at 45 deg..."
          rows={2}
          className={inputCls}
        />
      </div>
    </div>
  )
}
