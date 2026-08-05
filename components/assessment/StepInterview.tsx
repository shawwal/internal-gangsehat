'use client'

import { RichTextEditor } from './RichTextEditor'
import { RangeSlider } from '@/components/ui/RangeSlider'
import {
  RED_FLAG_LABEL, RED_FLAG_OPTIONS,
  PAIN_ONSET_LABEL, PAIN_ONSET_OPTIONS,
  PAIN_CHARACTER_LABEL, PAIN_CHARACTER_OPTIONS,
  PAIN_RADIATION_LABEL, PAIN_RADIATION_OPTIONS,
  PAIN_ASSOCIATED_SYMPTOM_LABEL, PAIN_ASSOCIATED_SYMPTOM_OPTIONS,
  PAIN_TIME_COURSE_LABEL, PAIN_TIME_COURSE_OPTIONS,
} from './types'
import type { AssessmentFormState } from './types'
import type { RedFlag, PainOnset, PainCharacter, PainRadiation, PainAssociatedSymptom, PainTimeCourse } from '@/types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
  readOnly?: boolean
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'
const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

export function StepInterview({ value, onChange, readOnly }: Props) {
  function toggleRedFlag(flag: RedFlag) {
    if (flag === 'NONE') {
      onChange({ red_flags: value.red_flags.includes('NONE') ? [] : ['NONE'] })
      return
    }
    const withoutNone = value.red_flags.filter((f) => f !== 'NONE')
    const next = withoutNone.includes(flag)
      ? withoutNone.filter((f) => f !== flag)
      : [...withoutNone, flag]
    onChange({ red_flags: next })
  }

  function toggleAssociatedSymptom(symptom: PainAssociatedSymptom) {
    if (symptom === 'None' || symptom === 'TidakDiperiksa') {
      onChange({ pain_associated_symptoms: value.pain_associated_symptoms.includes(symptom) ? [] : [symptom] })
      return
    }
    const withoutExclusive = value.pain_associated_symptoms.filter((s) => s !== 'None' && s !== 'TidakDiperiksa')
    const next = withoutExclusive.includes(symptom)
      ? withoutExclusive.filter((s) => s !== symptom)
      : [...withoutExclusive, symptom]
    onChange({ pain_associated_symptoms: next })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Goal:</strong> Understand the Patient-Identified Problems (PIPs). Let the patient tell their story first.
      </div>

      <div>
        <label className={labelCls}>History &amp; Mechanism of Injury (MOI)</label>
        <RichTextEditor
          value={value.history_moi}
          onChange={(html) => onChange({ history_moi: html })}
          placeholder="Exactly how did it happen? Did you hear a pop/crack?"
          readOnly={readOnly}
        />
      </div>

      <div className="rounded-2xl border border-border p-3 sm:p-4 space-y-4">
        <p className="text-xs font-semibold text-foreground">Riwayat Nyeri (SOCRATES)</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Lokasi (Site)</label>
            <input
              value={value.pain_site}
              onChange={(e) => onChange({ pain_site: e.target.value })}
              placeholder="Di mana tepatnya rasa nyeri itu?"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Awal Mula (Onset)</label>
            <select
              value={value.pain_onset}
              onChange={(e) => onChange({ pain_onset: e.target.value as PainOnset | '' })}
              className={inputCls}
            >
              <option value="">— Pilih —</option>
              {PAIN_ONSET_OPTIONS.map((o) => <option key={o} value={o}>{PAIN_ONSET_LABEL[o]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Karakteristik (Character)</label>
            <select
              value={value.pain_character}
              onChange={(e) => onChange({ pain_character: e.target.value as PainCharacter | '' })}
              className={inputCls}
            >
              <option value="">— Pilih —</option>
              {PAIN_CHARACTER_OPTIONS.map((o) => <option key={o} value={o}>{PAIN_CHARACTER_LABEL[o]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Penjalaran (Radiation)</label>
            <select
              value={value.pain_radiation}
              onChange={(e) => onChange({ pain_radiation: e.target.value as PainRadiation | '' })}
              className={inputCls}
            >
              <option value="">— Pilih —</option>
              {PAIN_RADIATION_OPTIONS.map((o) => <option key={o} value={o}>{PAIN_RADIATION_LABEL[o]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Pola Keluhan (Time Course)</label>
            <select
              value={value.pain_time_course}
              onChange={(e) => onChange({ pain_time_course: e.target.value as PainTimeCourse | '' })}
              className={inputCls}
            >
              <option value="">— Pilih —</option>
              {PAIN_TIME_COURSE_OPTIONS.map((o) => <option key={o} value={o}>{PAIN_TIME_COURSE_LABEL[o]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Gejala Penyerta (Associations)</label>
          <div className="flex flex-wrap gap-3">
            {PAIN_ASSOCIATED_SYMPTOM_OPTIONS.map((symptom) => (
              <label key={symptom} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.pain_associated_symptoms.includes(symptom)}
                  onChange={() => toggleAssociatedSymptom(symptom)}
                  className="rounded border-border accent-primary"
                />
                {PAIN_ASSOCIATED_SYMPTOM_LABEL[symptom]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Tingkat Keparahan (VAS / NPRS)</label>
          <RangeSlider
            value={value.pain_severity_vas}
            onChange={(v) => onChange({ pain_severity_vas: v })}
            gradient
            minLabel="Tidak nyeri (0)"
            maxLabel="Nyeri terburuk (10)"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Aggravating Factors (Makes it worse)</label>
          <RichTextEditor
            value={value.aggravating_factors}
            onChange={(html) => onChange({ aggravating_factors: html })}
            readOnly={readOnly}
          />
        </div>
        <div>
          <label className={labelCls}>Easing Factors (Makes it better)</label>
          <RichTextEditor
            value={value.easing_factors}
            onChange={(html) => onChange({ easing_factors: html })}
            readOnly={readOnly}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Riwayat Cedera/Pengobatan</label>
        <RichTextEditor
          value={value.riwayat_cedera_pengobatan}
          onChange={(html) => onChange({ riwayat_cedera_pengobatan: html })}
          placeholder="Riwayat cedera sebelumnya, pengobatan/terapi yang pernah dijalani..."
          readOnly={readOnly}
        />
      </div>

      <div>
        <label className={labelCls}>Red Flags Screening</label>
        <div className="flex flex-wrap gap-3">
          {RED_FLAG_OPTIONS.map((flag) => (
            <label key={flag} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={value.red_flags.includes(flag)}
                onChange={() => toggleRedFlag(flag)}
                className="rounded border-border accent-primary"
              />
              {RED_FLAG_LABEL[flag]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
