'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ScheduleSlot } from '@/components/schedule/types'

const SHIFT_LABEL: Record<'PAGI' | 'SORE', string> = { PAGI: 'Pagi', SORE: 'Sore' }

export default function ScheduleSlotsPage() {
  const [slots, setSlots]       = useState<ScheduleSlot[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<ScheduleSlot | null>(null)
  const [form, setForm]         = useState<{ shift: 'PAGI' | 'SORE'; slot_time: string }>({ shift: 'PAGI', slot_time: '' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function load() {
    const { data } = await createClient().from('schedule_slots').select('*').order('shift').order('slot_time')
    setSlots((data ?? []) as ScheduleSlot[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ shift: 'PAGI', slot_time: '' })
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
    const { error: err } = editing
      ? await supabase.from('schedule_slots').update({ shift: form.shift, slot_time: form.slot_time }).eq('id', editing.id)
      : await supabase.from('schedule_slots').insert({ shift: form.shift, slot_time: form.slot_time })
    setSaving(false)
    if (err) {
      setError(err.code === '23505' ? 'Slot waktu ini sudah ada untuk shift tersebut' : err.message)
      return
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(s: ScheduleSlot) {
    await createClient().from('schedule_slots').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  const morning   = slots.filter((s) => s.shift === 'PAGI')
  const afternoon = slots.filter((s) => s.shift === 'SORE')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Slot Jadwal</h1>
          <p className="text-sm text-muted-foreground">Kelola pilihan waktu Pagi/Sore pada dialog Tambah Jadwal</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Tambah Slot
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {([['Pagi', morning], ['Sore', afternoon]] as const).map(([label, group]) => (
            <div key={label} className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">{label}</h2>
              {group.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada slot</p>
              ) : (
                <div className="space-y-2">
                  {group.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{s.slot_time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_active ? 'bg-chart-4/15 text-chart-4' : 'bg-muted text-muted-foreground'}`}>
                          {s.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <button onClick={() => toggleActive(s)} className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
                          {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">
              {editing ? 'Edit Slot' : 'Tambah Slot'}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Shift</label>
                <select
                  value={form.shift}
                  onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value as 'PAGI' | 'SORE' }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="PAGI">Pagi</option>
                  <option value="SORE">Sore</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Waktu</label>
                <input
                  required
                  type="time"
                  value={form.slot_time}
                  onChange={(e) => setForm((f) => ({ ...f, slot_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {error && <p className="text-xs text-[#FF3B30]">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
