'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays, Plus, RefreshCw, Pencil, Trash2,
  X, CheckCircle2, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleRow {
  id: string
  hari: string
  shift: string
  jam_mulai: string
  jam_selesai: string
  status: 'AKTIF' | 'OFF'
  notes: string | null
  branches: { name: string } | null
}

interface BranchOption { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const HARI_LIST  = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD']
const SHIFT_LIST = ['PAGI', 'SORE']

const EMPTY_FORM = {
  branch_id:   '',
  hari:        'SENIN',
  shift:       'PAGI',
  jam_mulai:   '09:00',
  jam_selesai: '17:00',
  status:      'AKTIF' as 'AKTIF' | 'OFF',
  notes:       '',
}

// ─── Small Components ─────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color,
}: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'AKTIF' | 'OFF' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold tracking-wider ${
      status === 'AKTIF' ? 'bg-[#34C759] text-white' : 'bg-[#FF3B30] text-white'
    }`}>
      {status === 'AKTIF' ? 'MASUK' : 'OFF'}
    </span>
  )
}

// Day order for sorting display
const DAY_ORDER = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MySchedulePage() {
  const [userId, setUserId]     = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [rows, setRows]         = useState<ScheduleRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [branches, setBranches] = useState<BranchOption[]>([])

  // Modal / action state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })

  // ── Bootstrap: get current user ─────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const [{ data: profile }, { data: br }] = await Promise.all([
        supabase
          .from('internal_profiles')
          .select('full_name')
          .eq('id', user.id)
          .single(),
        supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
      ])

      setUserName(profile?.full_name ?? '')
      setBranches((br ?? []) as BranchOption[])
    }
    init()
  }, [])

  // ── Load own schedule rows ───────────────────────────────────────────────────
  useEffect(() => {
    if (userId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function load() {
    if (!userId) return
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('schedules')
      .select('id, hari, shift, jam_mulai, jam_selesai, status, notes, branches!branch_id(name)')
      .eq('staff_id', userId)
      .order('hari')
      .order('shift')

    if (error) console.error('[my-schedule] load error:', error)
    setRows((data ?? []) as unknown as ScheduleRow[])
    setLoading(false)
  }

  // ── Modal helpers ────────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setShowModal(true)
  }

  function openEdit(row: ScheduleRow) {
    setForm({
      branch_id:   '', // branch_id not in select; will default to null on save
      hari:        row.hari,
      shift:       row.shift,
      jam_mulai:   row.jam_mulai?.slice(0, 5) ?? '09:00',
      jam_selesai: row.jam_selesai?.slice(0, 5) ?? '17:00',
      status:      row.status,
      notes:       row.notes ?? '',
    })
    setEditId(row.id)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditId(null)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      staff_id:    userId,
      branch_id:   form.branch_id || null,
      hari:        form.hari,
      shift:       form.shift,
      jam_mulai:   form.jam_mulai,
      jam_selesai: form.jam_selesai,
      status:      form.status,
      notes:       form.notes.trim() || null,
    }

    const { error } = editId
      ? await supabase.from('schedules').update(payload).eq('id', editId)
      : await supabase.from('schedules').insert(payload)

    if (error) {
      alert(
        error.code === '23505'
          ? 'Jadwal untuk hari dan shift ini sudah ada.'
          : 'Gagal menyimpan: ' + error.message,
      )
      setSaving(false)
      return
    }

    setSaving(false)
    closeModal()
    load()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await createClient().from('schedules').delete().eq('id', deleteId)
    setDeleting(false)
    setDeleteId(null)
    load()
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const masukCount = rows.filter((r) => r.status === 'AKTIF').length
  const offCount   = rows.filter((r) => r.status === 'OFF').length

  // Group rows by day order for display
  const sorted = [...rows].sort(
    (a, b) => DAY_ORDER.indexOf(a.hari) - DAY_ORDER.indexOf(b.hari),
  )

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Jadwal Saya</h1>
          <p className="text-sm text-muted-foreground">
            {userName ? `Jadwal kerja mingguan — ${userName}` : 'Lihat dan kelola jadwal kerja Anda'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Refresh"
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus size={15} /> Tambah
          </button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          <>
            <div className="h-[60px] bg-muted animate-pulse rounded-2xl" />
            <div className="h-[60px] bg-muted animate-pulse rounded-2xl" />
            <div className="h-[60px] bg-muted animate-pulse rounded-2xl" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Jadwal"
              value={rows.length}
              icon={<CalendarDays size={16} className="text-foreground" />}
              color="bg-muted"
            />
            <StatCard
              label="Masuk"
              value={masukCount}
              icon={<CheckCircle2 size={16} className="text-[#34C759]" />}
              color="bg-[#34C759]/15"
            />
            <StatCard
              label="OFF"
              value={offCount}
              icon={<XCircle size={16} className="text-[#FF3B30]" />}
              color="bg-[#FF3B30]/10"
            />
          </>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['HARI', 'SHIFT', 'JAM MULAI', 'JAM SELESAI', 'KETERANGAN', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-xs font-semibold text-muted-foreground text-left ${
                      i === 5 ? 'w-20 text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {[64, 48, 52, 52, 60, 40].map((w, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div
                          className="h-3.5 bg-muted animate-pulse rounded-md"
                          style={{ width: `${w}px` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <CalendarDays size={22} className="text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Belum ada jadwal</p>
                      <p className="text-xs text-muted-foreground">
                        Tambahkan jadwal kerja mingguan Anda
                      </p>
                      <button
                        onClick={openAdd}
                        className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        <Plus size={14} /> Tambah Jadwal Pertama
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Hari */}
                    <td className="px-4 py-3.5 font-medium text-foreground">{row.hari}</td>

                    {/* Shift */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.shift === 'PAGI'
                          ? 'bg-[color:var(--secondary)]/20 text-secondary'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {row.shift}
                      </span>
                    </td>

                    {/* Times */}
                    <td className="px-4 py-3.5 font-mono text-foreground">
                      {row.jam_mulai?.slice(0, 5) ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-foreground">
                      {row.jam_selesai?.slice(0, 5) ?? '—'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          title="Edit"
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteId(row.id)}
                          title="Hapus"
                          className="p-1.5 rounded-lg hover:bg-[#FF3B30]/10 text-muted-foreground hover:text-[#FF3B30] transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        {!loading && sorted.length > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{sorted.length} jadwal terdaftar</p>
          </div>
        )}
      </div>

      {/* ── Weekly summary chips ─────────────────────────────────────────────── */}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {DAY_ORDER.map((day) => {
            const dayRows = sorted.filter((r) => r.hari === day)
            if (dayRows.length === 0) return null
            return (
              <div
                key={day}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-card rounded-xl border border-border text-xs"
              >
                <span className="font-medium text-foreground">{day}</span>
                {dayRows.map((r) => (
                  <StatusBadge key={r.id} status={r.status} />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">
                {editId ? 'Edit Jadwal' : 'Tambah Jadwal'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">

              {/* Cabang */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Cabang</label>
                <select
                  value={form.branch_id}
                  onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Hari + Shift */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Hari</label>
                  <select
                    value={form.hari}
                    onChange={(e) => setForm((f) => ({ ...f, hari: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {HARI_LIST.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Shift</label>
                  <select
                    value={form.shift}
                    onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {SHIFT_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Jam Mulai</label>
                  <input
                    type="time"
                    value={form.jam_mulai}
                    onChange={(e) => setForm((f) => ({ ...f, jam_mulai: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Jam Selesai</label>
                  <input
                    type="time"
                    value={form.jam_selesai}
                    onChange={(e) => setForm((f) => ({ ...f, jam_selesai: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Status toggle */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-2">Status</label>
                <div className="flex gap-2">
                  {(['AKTIF', 'OFF'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border ${
                        form.status === s
                          ? s === 'AKTIF'
                            ? 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/40'
                            : 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/30'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {s === 'AKTIF' ? 'MASUK' : 'OFF'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={closeModal}
                className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-[#FF3B30]" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Hapus Jadwal?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Jadwal ini akan dihapus secara permanen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-[#FF3B30] text-white text-sm font-medium hover:bg-[#FF3B30]/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
