'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays, Plus, RefreshCw, Pencil, Trash2,
  X, Search, CheckCircle2, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleRow {
  id: string
  staff_id: string
  branch_id: string | null
  hari: string
  shift: string
  jam_mulai: string
  jam_selesai: string
  status: 'AKTIF' | 'OFF'
  notes: string | null
  internal_profiles: { full_name: string } | null
  branches: { name: string } | null
}

interface StaffOption { id: string; full_name: string }
interface BranchOption { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const HARI_LIST  = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD']
const SHIFT_LIST = ['PAGI', 'SORE']
const PAGE_SIZES = [10, 25, 50]

const EMPTY_FORM = {
  staff_id:    '',
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
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold tracking-wider ${
        status === 'AKTIF'
          ? 'bg-[#34C759] text-white'
          : 'bg-[#FF3B30] text-white'
      }`}
    >
      {status === 'AKTIF' ? 'MASUK' : 'OFF'}
    </span>
  )
}

function ShiftBadge({ shift }: { shift: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        shift === 'PAGI'
          ? 'bg-[color:var(--secondary)]/20 text-[color:var(--secondary-foreground)]'
          : 'bg-primary/10 text-primary'
      }`}
    >
      {shift}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-0">
      {[12, 120, 64, 48, 52, 52, 60, 40].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-3.5 bg-muted animate-pulse rounded-md"
            style={{ width: `${w}px` }}
          />
        </td>
      ))}
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  // Data
  const [rows, setRows]           = useState<ScheduleRow[]>([])
  const [total, setTotal]         = useState(0)
  const [totalMasuk, setTotalMasuk] = useState(0)
  const [totalOff, setTotalOff]   = useState(0)
  const [loading, setLoading]     = useState(true)
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [branches, setBranches]   = useState<BranchOption[]>([])

  // Filters + pagination
  const [search, setSearch]         = useState('')
  const [hariFilter, setHariFilter] = useState('')
  const [shiftFilter, setShiftFilter] = useState('')
  const [pageSize, setPageSize]     = useState(10)
  const [page, setPage]             = useState(0)

  // Modal / action state
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })

  // ── Load form metadata (staff list + branches) once ─────────────────────────
  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient()
      const [{ data: staff }, { data: br }] = await Promise.all([
        supabase
          .from('internal_profiles')
          .select('id, full_name')
          .in('role', ['therapist', 'staff', 'manager'])
          .order('full_name'),
        supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
      ])
      setStaffList((staff ?? []) as StaffOption[])
      setBranches((br ?? []) as BranchOption[])
    }
    loadMeta()
  }, [])

  // ── Reset page when filters change ──────────────────────────────────────────
  useEffect(() => { setPage(0) }, [search, hariFilter, shiftFilter, pageSize])

  // ── Load paginated data + stats ──────────────────────────────────────────────
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, hariFilter, shiftFilter, search])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const from = page * pageSize
    const to   = from + pageSize - 1

    // Two-step search by staff name
    let staffIds: string[] | null = null
    if (search.trim()) {
      const { data: profiles } = await supabase
        .from('internal_profiles')
        .select('id')
        .ilike('full_name', `%${search.trim()}%`)
      staffIds = (profiles ?? []).map((p) => p.id)
      if (staffIds.length === 0) {
        setRows([]); setTotal(0); setTotalMasuk(0); setTotalOff(0)
        setLoading(false)
        return
      }
    }

    // Build base filter helper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function applyFilters(q: any) {
      if (hariFilter)  q = q.eq('hari', hariFilter)
      if (shiftFilter) q = q.eq('shift', shiftFilter)
      if (staffIds)    q = q.in('staff_id', staffIds)
      return q
    }

    // Run main query + stat counts in parallel
    const [{ data, count }, { count: masukCnt }, { count: offCnt }] = await Promise.all([
      applyFilters(
        supabase
          .from('schedules')
          .select(
            'id, staff_id, branch_id, hari, shift, jam_mulai, jam_selesai, status, notes, internal_profiles!staff_id(full_name), branches!branch_id(name)',
            { count: 'exact' },
          )
          .order('hari')
          .order('shift')
          .range(from, to),
      ),
      applyFilters(
        supabase
          .from('schedules')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'AKTIF'),
      ),
      applyFilters(
        supabase
          .from('schedules')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'OFF'),
      ),
    ])

    setRows((data ?? []) as unknown as ScheduleRow[])
    setTotal(count ?? 0)
    setTotalMasuk(masukCnt ?? 0)
    setTotalOff(offCnt ?? 0)
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
      staff_id:    row.staff_id,
      branch_id:   row.branch_id ?? '',
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
    if (!form.staff_id) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      staff_id:    form.staff_id,
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
      alert('Gagal menyimpan: ' + error.message)
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

  // ── Pagination ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const fromIdx    = total === 0 ? 0 : page * pageSize + 1
  const toIdx      = Math.min(page * pageSize + pageSize, total)

  function pageNums(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i)
    const nums: (number | '...')[] = [0]
    if (page > 2) nums.push('...')
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) nums.push(i)
    if (page < totalPages - 3) nums.push('...')
    nums.push(totalPages - 1)
    return nums
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Master Jadwal</h1>
          <p className="text-sm text-muted-foreground">Kelola jadwal kerja staff dan terapis</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Refresh data"
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
              value={total}
              icon={<CalendarDays size={16} className="text-foreground" />}
              color="bg-muted"
            />
            <StatCard
              label="Masuk"
              value={totalMasuk}
              icon={<CheckCircle2 size={16} className="text-[#34C759]" />}
              color="bg-[#34C759]/15"
            />
            <StatCard
              label="OFF"
              value={totalOff}
              icon={<XCircle size={16} className="text-[#FF3B30]" />}
              color="bg-[#FF3B30]/10"
            />
          </>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama staff..."
            className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Hari */}
        <select
          value={hariFilter}
          onChange={(e) => setHariFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Semua Hari</option>
          {HARI_LIST.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>

        {/* Shift */}
        <select
          value={shiftFilter}
          onChange={(e) => setShiftFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Semua Shift</option>
          {SHIFT_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Page size */}
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">data</span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  { label: 'NO',          cls: 'w-12' },
                  { label: 'NAMA STAFF',  cls: '' },
                  { label: 'HARI',        cls: 'w-24' },
                  { label: 'SHIFT',       cls: 'w-20' },
                  { label: 'JAM MULAI',   cls: 'w-28' },
                  { label: 'JAM SELESAI', cls: 'w-28' },
                  { label: 'KETERANGAN',  cls: 'w-28' },
                  { label: '',            cls: 'w-20' },
                ].map(({ label, cls }, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-xs font-semibold text-muted-foreground text-left ${cls}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <CalendarDays size={22} className="text-primary" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Belum ada jadwal</p>
                      <p className="text-xs text-muted-foreground">
                        {search || hariFilter || shiftFilter
                          ? 'Tidak ada jadwal yang sesuai filter'
                          : 'Klik Tambah untuk menambahkan jadwal baru'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* No */}
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {page * pageSize + idx + 1}
                    </td>

                    {/* Name + branch */}
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-foreground">
                        {row.internal_profiles?.full_name ?? '—'}
                      </span>
                      {row.branches?.name && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.branches.name}
                        </span>
                      )}
                    </td>

                    {/* Hari */}
                    <td className="px-4 py-3.5 text-foreground">{row.hari}</td>

                    {/* Shift */}
                    <td className="px-4 py-3.5">
                      <ShiftBadge shift={row.shift} />
                    </td>

                    {/* Times */}
                    <td className="px-4 py-3.5 font-mono text-foreground">
                      {row.jam_mulai?.slice(0, 5) ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-foreground">
                      {row.jam_selesai?.slice(0, 5) ?? '—'}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          title="Edit jadwal"
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteId(row.id)}
                          title="Hapus jadwal"
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

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {fromIdx} – {toIdx} dari {total} data
            </p>

            <div className="flex items-center gap-0.5">
              {/* First + prev */}
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                ‹
              </button>

              {/* Page numbers */}
              {pageNums().map((p, i) =>
                p === '...' ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      page === p
                        ? 'bg-primary text-white'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {(p as number) + 1}
                  </button>
                ),
              )}

              {/* Next + last */}
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

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
            {/* Modal header */}
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

            {/* Modal body */}
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">

              {/* Staff */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Staff / Terapis <span className="text-[#FF3B30]">*</span>
                </label>
                <select
                  value={form.staff_id}
                  onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih Staff --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Branch */}
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

            {/* Modal footer */}
            <div className="flex gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={closeModal}
                className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.staff_id}
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
              Jadwal ini akan dihapus secara permanen dan tidak dapat dipulihkan.
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
