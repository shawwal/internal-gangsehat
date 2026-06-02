'use client'

import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SalarySetting } from './types'
import { ROLE_LABELS, ALL_ROLES, formatRupiah } from './types'

interface Props {
  settings: SalarySetting[]
  onSaved: (updated: SalarySetting[]) => void
}

type RowDraft = {
  base_salary: string
  transport_allowance: string
  meal_allowance: string
  bonus_target_pct: string
}

function toRowDraft(s: SalarySetting): RowDraft {
  return {
    base_salary: String(s.base_salary),
    transport_allowance: String(s.transport_allowance),
    meal_allowance: String(s.meal_allowance),
    bonus_target_pct: String(s.bonus_target_pct),
  }
}

export function SalarySettingsTable({ settings, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => {
    const map: Record<string, RowDraft> = {}
    for (const s of settings) map[s.role] = toRowDraft(s)
    return map
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function update(role: string, field: keyof RowDraft, value: string) {
    setDrafts(d => ({ ...d, [role]: { ...d[role], [field]: value } }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const upserts = ALL_ROLES.map(role => ({
      role,
      base_salary:         Math.max(0, parseInt(drafts[role]?.base_salary ?? '0') || 0),
      transport_allowance: Math.max(0, parseInt(drafts[role]?.transport_allowance ?? '0') || 0),
      meal_allowance:      Math.max(0, parseInt(drafts[role]?.meal_allowance ?? '0') || 0),
      bonus_target_pct:    Math.max(0, parseFloat(drafts[role]?.bonus_target_pct ?? '0') || 0),
      updated_by:          user?.id ?? null,
    }))

    const { data, error } = await supabase
      .from('salary_settings')
      .upsert(upserts, { onConflict: 'role' })
      .select()

    setSaving(false)
    if (error) {
      setToast('Gagal menyimpan: ' + error.message)
    } else {
      setToast('Formula gaji berhasil disimpan')
      if (data) onSaved(data as SalarySetting[])
    }
    setTimeout(() => setToast(''), 4000)
  }

  const COLS: { field: keyof RowDraft; label: string; pct?: boolean }[] = [
    { field: 'base_salary',         label: 'Gaji Pokok (Rp)' },
    { field: 'transport_allowance', label: 'Transport (Rp)' },
    { field: 'meal_allowance',      label: 'Makan (Rp)' },
    { field: 'bonus_target_pct',    label: 'Bonus Target (%)', pct: true },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Formula Gaji per Jabatan</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nilai default yang digunakan saat generate penggajian. Override per karyawan tetap diprioritaskan.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>

      {/* Desktop table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Jabatan
                </th>
                {COLS.map(c => (
                  <th key={c.field} className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.map((role, i) => (
                <tr key={role} className={`${i !== ALL_ROLES.length - 1 ? 'border-b border-border/30' : ''} hover:bg-muted/20 transition-colors`}>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
                  </td>
                  {COLS.map(c => (
                    <td key={c.field} className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step={c.pct ? '0.1' : '1000'}
                        value={drafts[role]?.[c.field] ?? '0'}
                        onChange={e => update(role, c.field, e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full text-right px-2.5 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring min-w-[100px]"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info note */}
      <p className="text-xs text-muted-foreground bg-muted/30 px-4 py-3 rounded-xl">
        <strong>Bonus Target (%):</strong> Persentase dari gaji pokok yang ditambahkan sebagai bonus jika karyawan mencapai 100% target bulanan.
        Contoh: Gaji pokok Rp 5.000.000 dengan bonus target 10% → bonus Rp 500.000 jika target tercapai penuh.
      </p>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
