'use client'

import { useState, useEffect } from 'react'
import { X, CalendarRange, Sun, Moon, RotateCcw, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { StaffOption, BranchOption, WeeklyPattern } from './types'
import { HARI_LIST, SHIFT_HOURS, buildEmptyWeekly } from './constants'

interface Props {
  open: boolean
  staffList: StaffOption[]
  branches: BranchOption[]
  onClose: () => void
  onSaved: () => void
}

const HARI_LABEL: Record<string, string> = {
  SENIN:  'Senin',
  SELASA: 'Selasa',
  RABU:   'Rabu',
  KAMIS:  'Kamis',
  JUMAT:  'Jumat',
  SABTU:  'Sabtu',
  AHAD:   'Ahad',
}

const inputCls =
  'px-2.5 py-1.5 border border-border rounded-lg text-xs bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-colors'

export function MonthlyScheduleDialog({ open, staffList, branches, onClose, onSaved }: Props) {
  const [staffId, setStaffId]     = useState('')
  const [branchId, setBranchId]   = useState('')
  const [pattern, setPattern]     = useState<WeeklyPattern>(buildEmptyWeekly())
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [staffSearch, setStaffSearch] = useState('')

  // Load existing schedules when staff changes
  useEffect(() => {
    if (!staffId || !open) return
    async function fetchExisting() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('schedules')
        .select('hari, shift, jam_mulai, jam_selesai, status, branch_id')
        .eq('staff_id', staffId)
      const next = buildEmptyWeekly()
      if (data) {
        for (const row of data) {
          if (next[row.hari]) {
            next[row.hari] = {
              enabled:     row.status !== 'OFF',
              shift:       row.shift,
              jam_mulai:   row.jam_mulai?.slice(0, 5) ?? '08:00',
              jam_selesai: row.jam_selesai?.slice(0, 5) ?? '15:00',
              status:      row.status,
            }
            // Use branch from first row if not set yet
            if (!branchId && row.branch_id) setBranchId(row.branch_id)
          }
        }
      }
      setPattern(next)
      setLoading(false)
    }
    fetchExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, open])

  function reset() {
    setStaffId('')
    setBranchId('')
    setStaffSearch('')
    setPattern(buildEmptyWeekly())
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function patchDay(hari: string, patch: Partial<WeeklyPattern[string]>) {
    setPattern((prev) => ({
      ...prev,
      [hari]: { ...prev[hari], ...patch },
    }))
  }

  function toggleDay(hari: string) {
    const cur = pattern[hari]
    patchDay(hari, {
      enabled: !cur.enabled,
      status:  !cur.enabled ? 'AKTIF' : 'OFF',
    })
  }

  function applyShiftToAll(shift: 'PAGI' | 'SORE') {
    const hours = SHIFT_HOURS[shift]
    setPattern((prev) => {
      const next = { ...prev }
      for (const h of HARI_LIST) {
        next[h] = { ...next[h], shift, ...hours }
      }
      return next
    })
  }

  function applyShiftToChecked(shift: 'PAGI' | 'SORE') {
    const hours = SHIFT_HOURS[shift]
    setPattern((prev) => {
      const next = { ...prev }
      for (const h of HARI_LIST) {
        if (next[h].enabled) next[h] = { ...next[h], shift, ...hours }
      }
      return next
    })
  }

  function selectAllDays() {
    setPattern((prev) => {
      const next = { ...prev }
      for (const h of HARI_LIST) next[h] = { ...next[h], enabled: true, status: 'AKTIF' }
      return next
    })
  }

  function clearAllDays() {
    setPattern((prev) => {
      const next = { ...prev }
      for (const h of HARI_LIST) next[h] = { ...next[h], enabled: false, status: 'OFF' }
      return next
    })
  }

  async function handleSave() {
    if (!staffId) { setError('Pilih staff terlebih dahulu.'); return }
    setError('')
    setSaving(true)
    const supabase = createClient()

    const rows = HARI_LIST.map((hari) => ({
      staff_id:    staffId,
      branch_id:   branchId || null,
      hari,
      shift:       pattern[hari].shift,
      jam_mulai:   pattern[hari].jam_mulai,
      jam_selesai: pattern[hari].jam_selesai,
      status:      pattern[hari].enabled ? 'AKTIF' : 'OFF',
      notes:       null,
    }))

    const { error: err } = await supabase
      .from('schedules')
      .upsert(rows, { onConflict: 'staff_id,hari' })

    if (err) {
      setError('Gagal menyimpan: ' + err.message)
      setSaving(false)
      return
    }
    setSaving(false)
    reset()
    onSaved()
  }

  const filteredStaff = staffSearch
    ? staffList.filter((s) => s.full_name.toLowerCase().includes(staffSearch.toLowerCase()))
    : staffList

  const checkedCount = HARI_LIST.filter((h) => pattern[h].enabled).length

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarRange size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Jadwal Mingguan</h3>
              <p className="text-xs text-muted-foreground">Atur pola jadwal per hari untuk satu staff</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Staff + Branch selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                Staff / Terapis <span className="text-[#FF3B30]">*</span>
              </label>
              <input
                placeholder="Cari nama..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary mb-1"
              />
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                size={Math.min(5, filteredStaff.length + 1)}
              >
                <option value="">-- Pilih Staff --</option>
                {filteredStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Cabang</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Pilih Cabang --</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {/* Quick-action chips */}
              <div className="pt-2 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Terapkan ke hari aktif:</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyShiftToChecked('PAGI')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[color:var(--secondary)]/15 text-secondary hover:bg-[color:var(--secondary)]/25 transition-colors cursor-pointer"
                  >
                    <Sun size={11} /> Semua PAGI
                  </button>
                  <button
                    type="button"
                    onClick={() => applyShiftToChecked('SORE')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <Moon size={11} /> Semua SORE
                  </button>
                  <button
                    type="button"
                    onClick={selectAllDays}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#34C759]/10 text-[#34C759] hover:bg-[#34C759]/20 transition-colors cursor-pointer"
                  >
                    <Check size={11} /> Pilih semua
                  </button>
                  <button
                    type="button"
                    onClick={clearAllDays}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Day checklist grid ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Pola Jadwal Mingguan
              </p>
              <span className="text-xs text-muted-foreground">
                {checkedCount} / {HARI_LIST.length} hari aktif
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Memuat jadwal...</span>
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {HARI_LIST.map((hari) => {
                  const day    = pattern[hari]
                  const active = day.enabled

                  return (
                    <div
                      key={hari}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        active ? 'bg-card hover:bg-muted/20' : 'bg-muted/20 opacity-60 hover:opacity-80'
                      }`}
                    >
                      {/* Checkbox toggle */}
                      <button
                        type="button"
                        onClick={() => toggleDay(hari)}
                        aria-label={`Toggle ${hari}`}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          active
                            ? 'bg-primary border-primary'
                            : 'border-border bg-transparent hover:border-primary/50'
                        }`}
                      >
                        {active && <Check size={11} className="text-white" strokeWidth={3} />}
                      </button>

                      {/* Day label */}
                      <span
                        className={`w-14 text-sm font-semibold shrink-0 ${
                          active ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {HARI_LABEL[hari]}
                      </span>

                      {/* Shift selector */}
                      <div className="flex gap-1 shrink-0">
                        {(['PAGI', 'SORE'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={!active}
                            onClick={() =>
                              patchDay(hari, { shift: s, ...SHIFT_HOURS[s] })
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:cursor-default ${
                              day.shift === s && active
                                ? s === 'PAGI'
                                  ? 'bg-[color:var(--secondary)] text-white'
                                  : 'bg-primary text-white'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50'
                            }`}
                          >
                            {s === 'PAGI'
                              ? <span className="flex items-center gap-0.5"><Sun size={10} /> PAGI</span>
                              : <span className="flex items-center gap-0.5"><Moon size={10} /> SORE</span>
                            }
                          </button>
                        ))}
                      </div>

                      {/* Time inputs */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="time"
                          value={day.jam_mulai}
                          disabled={!active}
                          onChange={(e) => patchDay(hari, { jam_mulai: e.target.value })}
                          className={inputCls + ' w-full min-w-0 disabled:opacity-40 disabled:cursor-not-allowed font-mono'}
                        />
                        <span className="text-muted-foreground text-xs shrink-0">–</span>
                        <input
                          type="time"
                          value={day.jam_selesai}
                          disabled={!active}
                          onChange={(e) => patchDay(hari, { jam_selesai: e.target.value })}
                          className={inputCls + ' w-full min-w-0 disabled:opacity-40 disabled:cursor-not-allowed font-mono'}
                        />
                      </div>

                      {/* Status pill */}
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                          active ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {active ? 'MASUK' : 'OFF'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-[#FF3B30] bg-[#FF3B30]/10 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !staffId}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
              : <><Check size={14} /> Simpan {checkedCount} Jadwal</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
