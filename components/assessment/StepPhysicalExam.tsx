'use client'

import { Plus, Trash2 } from 'lucide-react'
import { RichTextEditor } from './RichTextEditor'
import { stripHtml } from '@/lib/richtext'
import {
  AROM_LABEL, AROM_OPTIONS, PROM_ENDFEEL_LABEL, PROM_ENDFEEL_OPTIONS,
  ISOMETRIC_LABEL, ISOMETRIC_OPTIONS, emptyJointExamRow,
  OBSERVATION_FINDING_LABEL, OBSERVATION_FINDING_OPTIONS,
} from './types'
import type { AssessmentFormState } from './types'
import type { AromResult, PromEndFeel, IsometricResistance, ObservationFinding } from '@/types'

interface Props {
  value: AssessmentFormState
  onChange: (patch: Partial<AssessmentFormState>) => void
  readOnly?: boolean
}

const labelCls = 'block text-xs font-medium text-foreground mb-1.5'
const selectCls = 'w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-input focus:outline-none focus:ring-2 focus:ring-primary'

export function StepPhysicalExam({ value, onChange, readOnly }: Props) {
  const rows = value.joint_exam_rows.length ? value.joint_exam_rows : [emptyJointExamRow()]
  const legacyRom = stripHtml(value.rom_active_passive)
  const showLegacyRom = !!legacyRom && rows.length === 1 && !rows[0].joint && !rows[0].arom && !rows[0].prom && !rows[0].isometric

  function updateRow(id: string, patch: Partial<AssessmentFormState['joint_exam_rows'][number]>) {
    onChange({ joint_exam_rows: rows.map((r) => r.id === id ? { ...r, ...patch } : r) })
  }

  function addRow() {
    onChange({ joint_exam_rows: [...rows, emptyJointExamRow()] })
  }

  function deleteRow(id: string) {
    if (rows.length <= 1) return
    onChange({ joint_exam_rows: rows.filter((r) => r.id !== id) })
  }

  function toggleObservationFinding(finding: ObservationFinding) {
    if (finding === 'Normal/Simetris' || finding === 'TidakDiperiksa') {
      onChange({ observation_findings: value.observation_findings.includes(finding) ? [] : [finding] })
      return
    }
    const withoutExclusive = value.observation_findings.filter((f) => f !== 'Normal/Simetris' && f !== 'TidakDiperiksa')
    const next = withoutExclusive.includes(finding)
      ? withoutExclusive.filter((f) => f !== finding)
      : [...withoutExclusive, finding]
    onChange({ observation_findings: next })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-300">
        <strong>Crucial Rule:</strong> Follow this exact sequence to avoid flaring up the patient&apos;s pain early. Do NOT palpate first! Observe → Clear Joints → Active ROM → Passive ROM → Strength → Special Tests → Palpation (last).
      </div>

      <div>
        <label className={labelCls}>1. Observation &amp; Gait / Posture</label>
        <div className="flex flex-wrap gap-3 mb-2">
          {OBSERVATION_FINDING_OPTIONS.map((finding) => (
            <label key={finding} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={value.observation_findings.includes(finding)}
                onChange={() => toggleObservationFinding(finding)}
                className="rounded border-border accent-primary"
              />
              {OBSERVATION_FINDING_LABEL[finding]}
            </label>
          ))}
        </div>
        <RichTextEditor
          value={value.observation_gait_posture}
          onChange={(html) => onChange({ observation_gait_posture: html })}
          placeholder="e.g. Antalgic gait, visible swelling on lateral ankle..."
          readOnly={readOnly}
        />
      </div>

      <div>
        <label className={labelCls}>2 &amp; 3. Pemeriksaan Sendi &amp; Gerak (AROM / PROM / Tahanan Isometrik)</label>
        <p className="text-[11px] text-muted-foreground mb-2">
          Prinsip Cyriax: Kuat/Tanpa Nyeri (Normal), Kuat/Nyeri (Lesi Ringan/Tendon), Lemah/Nyeri (Lesi Berat/Robek), Lemah/Tanpa Nyeri (Ruptur/Saraf).
        </p>

        {showLegacyRom && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300 mb-2">
            <strong>Catatan lama (pre-migrasi, read-only):</strong> {legacyRom}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left font-medium text-foreground p-2">Sendi / Gerakan</th>
                <th className="text-left font-medium text-foreground p-2">AROM</th>
                <th className="text-left font-medium text-foreground p-2">PROM / End-Feel</th>
                <th className="text-left font-medium text-foreground p-2">Tahanan Isometrik</th>
                <th className="text-center font-medium text-foreground p-2 w-10">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2">
                    <input
                      value={row.joint}
                      onChange={(e) => updateRow(row.id, { joint: e.target.value })}
                      placeholder="Misal: Fleksi Bahu Kanan"
                      className={selectCls}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={row.arom}
                      onChange={(e) => updateRow(row.id, { arom: e.target.value as AromResult | '' })}
                      className={selectCls}
                    >
                      <option value="">Pilih...</option>
                      {AROM_OPTIONS.map((o) => <option key={o} value={o}>{AROM_LABEL[o]}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={row.prom}
                      onChange={(e) => updateRow(row.id, { prom: e.target.value as PromEndFeel | '' })}
                      className={selectCls}
                    >
                      <option value="">Pilih...</option>
                      {PROM_ENDFEEL_OPTIONS.map((o) => <option key={o} value={o}>{PROM_ENDFEEL_LABEL[o]}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      value={row.isometric}
                      onChange={(e) => updateRow(row.id, { isometric: e.target.value as IsometricResistance | '' })}
                      className={selectCls}
                    >
                      <option value="">Pilih...</option>
                      {ISOMETRIC_OPTIONS.map((o) => <option key={o} value={o}>{ISOMETRIC_LABEL[o]}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      disabled={rows.length <= 1}
                      className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Hapus baris"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
        >
          <Plus size={13} /> Tambah Sendi / Gerakan
        </button>
      </div>

      <div>
        <label className={labelCls}>5. Special Orthopedic Tests</label>
        <RichTextEditor
          value={value.special_ortho_tests}
          onChange={(html) => onChange({ special_ortho_tests: html })}
          placeholder="e.g. Anterior Drawer (+), Talar Tilt (-)..."
          readOnly={readOnly}
        />
      </div>

      <div>
        <label className={labelCls}>6. Palpation (Done Last!)</label>
        <RichTextEditor
          value={value.palpation}
          onChange={(html) => onChange({ palpation: html })}
          placeholder="e.g. Point tenderness over the ATFL..."
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}
