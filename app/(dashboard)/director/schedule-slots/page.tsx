'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Loader2, Sunrise, Sunset } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ScheduleSlot } from '@/components/schedule/types'

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

const SHIFT_META = {
  PAGI: { label: 'Pagi', icon: Sunrise, accent: 'text-secondary' },
  SORE: { label: 'Sore', icon: Sunset,  accent: 'text-primary' },
} as const

function ToggleSwitch({ checked, onClick, disabled }: { checked: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={checked ? 'Nonaktifkan slot' : 'Aktifkan slot'}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50 ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function ScheduleSlotsPage() {
  const [slots, setSlots]       = useState<ScheduleSlot[]>([])
  const [loading, setLoading]   = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<ScheduleSlot | null>(null)
  const [form, setForm]         = useState<{ shift: 'PAGI' | 'SORE'; slot_time: string }>({ shift: 'PAGI', slot_time: '' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function sortSlots(list: ScheduleSlot[]) {
    return [...list].sort((a, b) => a.shift.localeCompare(b.shift) || a.slot_time.localeCompare(b.slot_time))
  }

  async function load() {
    setLoading(true)
    const { data } = await createClient().from('schedule_slots').select('*').order('shift').order('slot_time')
    setSlots((data ?? []) as ScheduleSlot[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew(shift?: 'PAGI' | 'SORE') {
    setEditing(null)
    setForm({ shift: shift ?? 'PAGI', slot_time: '' })
    setError('')
    setShowForm(true)
  }

  function openEdit(s: ScheduleSlot) {
    setEditing(s)
    setForm({ shift: s.shift, slot_time: s.slot_time })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()

    if (editing) {
      const prevSlots = slots
      const updated = { ...editing, shift: form.shift, slot_time: form.slot_time }
      setSlots((prev) => sortSlots(prev.map((s) => (s.id === editing.id ? updated : s))))

      const { error: err } = await supabase
        .from('schedule_slots')
        .update({ shift: form.shift, slot_time: form.slot_time })
        .eq('id', editing.id)

      setSaving(false)
      if (err) {
        setSlots(prevSlots)
        setError(err.code === '23505' ? 'Slot waktu ini sudah ada untuk shift tersebut' : err.message)
        return
      }
      setShowForm(false)
      return
    }

    const { data, error: err } = await supabase
      .from('schedule_slots')
      .insert({ shift: form.shift, slot_time: form.slot_time })
      .select()
      .single()

    setSaving(false)
    if (err) {
      setError(err.code === '23505' ? 'Slot waktu ini sudah ada untuk shift tersebut' : err.message)
      return
    }
    setSlots((prev) => sortSlots([...prev, data as ScheduleSlot]))
    setShowForm(false)
  }

  async function toggleActive(s: ScheduleSlot) {
    setTogglingId(s.id)
    setSlots((prev) => prev.map((row) => (row.id === s.id ? { ...row, is_active: !row.is_active } : row)))

    const { error: err } = await createClient().from('schedule_slots').update({ is_active: !s.is_active }).eq('id', s.id)
    setTogglingId(null)
    if (err) {
      setSlots((prev) => prev.map((row) => (row.id === s.id ? { ...row, is_active: s.is_active } : row)))
    }
  }

  async function handleDelete(s: ScheduleSlot) {
    if (!confirm(`Hapus slot ${s.slot_time}?`)) return
    setDeletingId(s.id)
    const prevSlots = slots
    setSlots((prev) => prev.filter((row) => row.id !== s.id))

    const { error: err } = await createClient().from('schedule_slots').delete().eq('id', s.id)
    setDeletingId(null)
    if (err) {
      setSlots(prevSlots)
      alert(err.message)
    }
  }

  const morning   = slots.filter((s) => s.shift === 'PAGI')
  const afternoon = slots.filter((s) => s.shift === 'SORE')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Slot Jadwal</h1>
          <p className="text-sm text-muted-foreground">
            Kelola pilihan waktu Pagi/Sore yang muncul pada dialog Tambah Jadwal
          </p>
        </div>
        <button
          onClick={() => openNew()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
        >
          <Plus size={16} /> Tambah Slot
        </button>
      </div>

      {/* Panels */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(['PAGI', 'SORE'] as const).map((shift) => {
          const meta  = SHIFT_META[shift]
          const Icon  = meta.icon
          const group = shift === 'PAGI' ? morning : afternoon

          return (
            <div key={shift} className="glass-card overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl bg-current/10 flex items-center justify-center ${meta.accent}`}>
                    <Icon size={16} className={meta.accent} />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                  {!loading && group.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                      {group.length} slot
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openNew(shift)}
                  className="text-xs text-primary hover:underline cursor-pointer shrink-0"
                >
                  + Tambah
                </button>
              </div>

              {/* Panel body */}
              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
                    <Loader2 size={15} className="animate-spin" /> Memuat...
                  </div>
                ) : group.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <p className="text-xs text-muted-foreground">Belum ada slot {meta.label.toLowerCase()}</p>
                    <button onClick={() => openNew(shift)} className="text-xs text-primary hover:underline cursor-pointer">
                      + Tambah sekarang
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {group.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border/60 transition-opacity ${
                          s.is_active ? '' : 'opacity-50'
                        }`}
                      >
                        <span className="text-sm font-semibold tabular-nums text-foreground">{s.slot_time}</span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
                            title="Edit slot"
                            aria-label="Edit slot"
                          >
                            <Pencil size={13} />
                          </button>
                          {deletingId === s.id ? (
                            <span className="p-1.5 flex items-center justify-center">
                              <Loader2 size={13} className="animate-spin text-muted-foreground" />
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDelete(s)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive cursor-pointer"
                              title="Hapus slot"
                              aria-label="Hapus slot"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          {togglingId === s.id ? (
                            <span className="w-9 h-5 flex items-center justify-center">
                              <Loader2 size={13} className="animate-spin text-muted-foreground" />
                            </span>
                          ) : (
                            <ToggleSwitch checked={s.is_active} onClick={() => toggleActive(s)} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h2 className="text-base font-semibold text-foreground">
                  {editing ? 'Edit Slot' : 'Tambah Slot'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSave}>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Shift</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['PAGI', 'SORE'] as const).map((s) => {
                        const meta = SHIFT_META[s]
                        const Icon = meta.icon
                        const sel  = form.shift === s
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, shift: s }))}
                            className={[
                              'flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border',
                              sel
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                            ].join(' ')}
                          >
                            <Icon size={14} /> {meta.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="slot-time" className="block text-xs font-medium text-foreground mb-1.5">Waktu</label>
                    <input
                      id="slot-time"
                      required
                      type="time"
                      value={form.slot_time}
                      onChange={(e) => setForm((f) => ({ ...f, slot_time: e.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
                  )}
                </div>

                <div className="flex gap-3 p-5 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.slot_time}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
