'use client'

import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SalarySetting } from './types'
import { ROLE_LABELS, ALL_ROLES } from './types'
import { CurrencyInput } from './CurrencyInput'

interface Props {
  settings: SalarySetting[]
  onSaved: (updated: SalarySetting[]) => void
}

// Store IDR fields as numbers, pct as string
type RowDraft = {
  base_salary: number
  transport_allowance: number
  meal_allowance: number
  bonus_target_pct: string
}

function toRowDraft(s: SalarySetting): RowDraft {
  return {
    base_salary:         s.base_salary,
    transport_allowance: s.transport_allowance,
    meal_allowance:      s.meal_allowance,
    bonus_target_pct:    String(s.bonus_target_pct),
  }
}

// Fallback row for roles not yet in DB
const EMPTY_ROW: RowDraft = { base_salary: 0, transport_allowance: 0, meal_allowance: 0, bonus_target_pct: '0' }

export function SalarySettingsTable({ settings, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => {
    const map: Record<string, RowDraft> = {}
    for (const s of settings) map[s.role] = toRowDraft(s)
    return map
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function setIDR(role: string, field: 'base_salary' | 'transport_allowance' | 'meal_allowance', value: number) {
    setDrafts(d => ({ ...d, [role]: { ...(d[role] ?? EMPTY_ROW), [field]: value } }))
  }

  function setPct(role: string, value: string) {
    setDrafts(d => ({ ...d, [role]: { ...(d[role] ?? EMPTY_ROW), bonus_target_pct: value } }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const upserts = ALL_ROLES.map(role => {
      const row = drafts[role] ?? EMPTY_ROW
      return {
        role,
        base_salary:         Math.max(0, row.base_salary),
        transport_allowance: Math.max(0, row.transport_allowance),
        meal_allowance:      Math.max(0, row.meal_allowance),
        bonus_target_pct:    Math.max(0, parseFloat(row.bonus_target_pct) || 0),
        updated_by:          user?.id ?? null,
      }
    })

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Formula Gaji per Jabatan</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nilai default saat generate penggajian. Override per karyawan tetap diprioritaskan.
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

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">
                  Jabatan
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Gaji Pokok (Rp)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Transport (Rp)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Makan (Rp)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Bonus Target (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.map((role, i) => {
                const row = drafts[role] ?? EMPTY_ROW
                return (
                  <tr
                    key={role}
                    className={`${i !== ALL_ROLES.length - 1 ? 'border-b border-border/30' : ''} hover:bg-muted/20 transition-colors`}
                  >
                    <td className="px-4 py-2">
                      <span className="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
                    </td>

                    {/* Gaji Pokok */}
                    <td className="px-4 py-2 min-w-[160px]">
                      <CurrencyInput
                        value={row.base_salary}
                        onChange={v => setIDR(role, 'base_salary', v)}
                      />
                    </td>

                    {/* Transport */}
                    <td className="px-4 py-2 min-w-[140px]">
                      <CurrencyInput
                        value={row.transport_allowance}
                        onChange={v => setIDR(role, 'transport_allowance', v)}
                      />
                    </td>

                    {/* Makan */}
                    <td className="px-4 py-2 min-w-[140px]">
                      <CurrencyInput
                        value={row.meal_allowance}
                        onChange={v => setIDR(role, 'meal_allowance', v)}
                      />
                    </td>

                    {/* Bonus % — plain number input, not IDR */}
                    <td className="px-4 py-2 min-w-[110px]">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={row.bonus_target_pct}
                        onChange={e => setPct(role, e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full text-right px-2.5 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {/* Spacer so rows stay the same height as IDR columns */}
                      <p className="h-[14px]" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground bg-muted/30 px-4 py-3 rounded-xl">
        <strong>Bonus Target (%):</strong> Persentase dari gaji pokok sebagai bonus jika karyawan mencapai 100% target bulanan.
        Contoh: Gaji pokok Rp 5.000.000 dengan bonus 10% → bonus Rp 500.000 jika target tercapai penuh.
      </p>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
