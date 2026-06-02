'use client'

import { useState } from 'react'
import { Pencil, X, Save, Loader2, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EmployeeSalary, SalarySetting } from './types'
import { ROLE_LABELS, formatRupiah } from './types'

interface Props {
  overrides: EmployeeSalary[]
  settings: SalarySetting[]   // role defaults for fallback display
  currentUserId: string
  onUpdated: () => void
}

interface EditDraft {
  staffId: string
  base_salary: string
  transport_allowance: string
  meal_allowance: string
  other_allowance: string
  notes: string
}

function getRoleDefault(settings: SalarySetting[], role: string) {
  return settings.find(s => s.role === role)
}

export function EmployeeOverrideList({ overrides, settings, currentUserId, onUpdated }: Props) {
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function startEdit(o: EmployeeSalary) {
    const def = getRoleDefault(settings, o.internal_profiles?.role ?? '')
    setEditId(o.staff_id)
    setDraft({
      staffId: o.staff_id,
      base_salary:         String(o.base_salary         ?? def?.base_salary         ?? 0),
      transport_allowance: String(o.transport_allowance ?? def?.transport_allowance ?? 0),
      meal_allowance:      String(o.meal_allowance       ?? def?.meal_allowance       ?? 0),
      other_allowance:     String(o.other_allowance      ?? 0),
      notes:               o.notes ?? '',
    })
  }

  function cancelEdit() {
    setEditId(null)
    setDraft(null)
  }

  async function saveOverride() {
    if (!draft) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      staff_id:            draft.staffId,
      base_salary:         parseInt(draft.base_salary)         || 0,
      transport_allowance: parseInt(draft.transport_allowance) || 0,
      meal_allowance:      parseInt(draft.meal_allowance)       || 0,
      other_allowance:     parseInt(draft.other_allowance)      || 0,
      notes:               draft.notes.trim() || null,
      updated_by:          currentUserId,
    }

    const { error } = await supabase
      .from('employee_salaries')
      .upsert(payload, { onConflict: 'staff_id' })

    setSaving(false)
    if (error) {
      setToast('Gagal menyimpan: ' + error.message)
    } else {
      setToast('Override berhasil disimpan')
      cancelEdit()
      onUpdated()
    }
    setTimeout(() => setToast(''), 4000)
  }

  function numChange(field: keyof EditDraft) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!draft) return
      const raw = e.target.value.replace(/^0+(?=\d)/, '')
      setDraft({ ...draft, [field]: raw })
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Override Gaji per Karyawan</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Override menggantikan formula jabatan untuk karyawan tertentu. Klik ikon edit untuk mengubah.
        </p>
      </div>

      {overrides.length === 0 && (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Belum ada override. Semua karyawan menggunakan formula jabatan.</p>
        </div>
      )}

      <div className="space-y-2">
        {overrides.map(o => {
          const profile = o.internal_profiles
          const def = getRoleDefault(settings, profile?.role ?? '')
          const isEditing = editId === o.staff_id

          const displayBase  = o.base_salary         ?? def?.base_salary         ?? 0
          const displayTrans = o.transport_allowance ?? def?.transport_allowance ?? 0
          const displayMeal  = o.meal_allowance       ?? def?.meal_allowance       ?? 0
          const hasOverride  = o.base_salary !== null || o.transport_allowance !== null || o.meal_allowance !== null

          return (
            <div key={o.staff_id} className="glass-card p-4 space-y-3">
              {/* Employee header */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{profile?.full_name ?? '—'}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {profile?.role ? (ROLE_LABELS[profile.role] ?? profile.role) : '—'}
                    </span>
                    {profile?.branches?.name && (
                      <span className="text-xs text-muted-foreground">· {profile.branches.name}</span>
                    )}
                    {hasOverride && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        Override aktif
                      </span>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(o)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Edit override"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>

              {/* Summary (non-editing) */}
              {!isEditing && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Gaji Pokok',  value: displayBase },
                    { label: 'Transport',   value: displayTrans },
                    { label: 'Makan',       value: displayMeal },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/40 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-foreground">{formatRupiah(value as number)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline edit form */}
              {isEditing && draft && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { field: 'base_salary',         label: 'Gaji Pokok' },
                      { field: 'transport_allowance', label: 'Tunjangan Transport' },
                      { field: 'meal_allowance',      label: 'Tunjangan Makan' },
                      { field: 'other_allowance',     label: 'Tunjangan Lainnya' },
                    ] as { field: keyof EditDraft; label: string }[]).map(({ field, label }) => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
                        <input
                          type="number"
                          min={0}
                          value={draft[field]}
                          onChange={numChange(field)}
                          onFocus={e => e.target.select()}
                          className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Keterangan</label>
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={e => setDraft({ ...draft, notes: e.target.value })}
                      placeholder="Opsional..."
                      className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
                    >
                      <X size={13} /> Batal
                    </button>
                    <button
                      onClick={saveOverride}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
