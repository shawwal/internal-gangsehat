'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Plus, CalendarRange, LayoutList, CalendarDays, CheckSquare, Loader2, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ScheduleRow, StaffOption, BranchOption, ScheduleForm } from '@/components/schedule/types'
import { EMPTY_FORM } from '@/components/schedule/constants'
import { ScheduleStats } from '@/components/schedule/ScheduleStats'
import { ScheduleFilters } from '@/components/schedule/ScheduleFilters'
import { ScheduleTable } from '@/components/schedule/ScheduleTable'
import { ScheduleDialog } from '@/components/schedule/ScheduleDialog'
import { MonthlyScheduleDialog } from '@/components/schedule/MonthlyScheduleDialog'
import { DeleteDialog } from '@/components/schedule/DeleteDialog'
import { ScheduleCalendarView } from '@/components/schedule/ScheduleCalendarView'
import { BulkEditDialog } from '@/components/schedule/BulkEditDialog'
import { StatusListModal } from '@/components/schedule/StatusListModal'

type ViewMode = 'table' | 'calendar'

export default function SchedulesPage() {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [rows, setRows]             = useState<ScheduleRow[]>([])
  const [total, setTotal]           = useState(0)
  const [totalMasuk, setTotalMasuk] = useState(0)
  const [totalOff, setTotalOff]     = useState(0)
  const [loading, setLoading]       = useState(true)
  const [staffList, setStaffList]   = useState<StaffOption[]>([])
  const [branches, setBranches]     = useState<BranchOption[]>([])
  const [morningSlots, setMorningSlots]     = useState<string[]>([])
  const [afternoonSlots, setAfternoonSlots] = useState<string[]>([])
  const [viewMode, setViewMode]     = useState<ViewMode>('table')

  // ── Filters + pagination ─────────────────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [hariFilter, setHariFilter]   = useState('')
  const [shiftFilter, setShiftFilter] = useState('')
  const [pageSize, setPageSize]       = useState(10)
  const [page, setPage]               = useState(0)

  // ── Selection ────────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<string[]>([])
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ── Status list modal ────────────────────────────────────────────────────────
  const [statusModal, setStatusModal] = useState<'AKTIF' | 'OFF' | null>(null)

  // ── Current user branch ──────────────────────────────────────────────────────
  const [userBranchId, setUserBranchId] = useState<string | null | undefined>(undefined)

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [showSingle, setShowSingle]   = useState(false)
  const [showMonthly, setShowMonthly] = useState(false)
  const [editId, setEditId]           = useState<string | null>(null)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [form, setForm]               = useState<ScheduleForm>({ ...EMPTY_FORM })

  // ── Load metadata once ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: staff }, { data: br }, { data: profile }, { data: slots }] = await Promise.all([
        supabase
          .from('internal_profiles')
          .select('id, full_name, branch_id, avatar_url')
          .in('role', ['therapist', 'staff', 'manager', 'director'])
          .order('full_name'),
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
        supabase.from('internal_profiles').select('branch_id').eq('id', user!.id).single(),
        supabase.from('schedule_slots').select('shift, slot_time').eq('is_active', true).order('slot_time'),
      ])
      setStaffList((staff ?? []) as StaffOption[])
      setBranches((br ?? []) as BranchOption[])
      setUserBranchId(profile?.branch_id ?? null)
      setMorningSlots((slots ?? []).filter((s) => s.shift === 'PAGI').map((s) => s.slot_time))
      setAfternoonSlots((slots ?? []).filter((s) => s.shift === 'SORE').map((s) => s.slot_time))
    }
    loadMeta()
  }, [])

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (userBranchId === undefined) return
    load()
  }, [page, pageSize, hariFilter, shiftFilter, search, userBranchId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const from = page * pageSize
    const to   = from + pageSize - 1

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function applyFilters(q: any) {
      if (userBranchId) q = q.eq('branch_id', userBranchId)
      if (hariFilter)   q = q.eq('hari', hariFilter)
      if (shiftFilter)  q = q.eq('shift', shiftFilter)
      if (staffIds)     q = q.in('staff_id', staffIds)
      return q
    }

    const [{ data, count }, { count: masukCnt }, { count: offCnt }] = await Promise.all([
      applyFilters(
        supabase
          .from('schedules')
          .select(
            'id, staff_id, branch_id, hari, shift, jam_mulai, jam_selesai, status, notes, internal_profiles!staff_id(full_name), branches!branch_id(name)',
            { count: 'exact' },
          )
          .order('hari').order('shift').range(from, to),
      ),
      applyFilters(
        supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('status', 'AKTIF'),
      ),
      applyFilters(
        supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('status', 'OFF'),
      ),
    ])

    setRows((data ?? []) as unknown as ScheduleRow[])
    setTotal(count ?? 0)
    setTotalMasuk(masukCnt ?? 0)
    setTotalOff(offCnt ?? 0)
    setLoading(false)
  }

  // ── Single dialog helpers ────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setShowSingle(true)
  }

  function openEdit(row: ScheduleRow) {
    setForm({
      staff_ids:   [row.staff_id],
      branch_id:   row.branch_id ?? '',
      hari:        [row.hari],
      shift:       row.shift,
      jam_mulai:   row.jam_mulai?.slice(0, 5) ?? '08:00',
      jam_selesai: row.jam_selesai?.slice(0, 5) ?? '15:00',
      status:      row.status,
      notes:       row.notes ?? '',
    })
    setEditId(row.id)
    setShowSingle(true)
  }

  async function handleSave() {
    if (form.staff_ids.length === 0) return
    const hariList = Array.isArray(form.hari) ? form.hari : [form.hari]
    if (hariList.length === 0) return

    setSaving(true)
    const supabase = createClient()
    const base = {
      branch_id:   form.branch_id || null,
      shift:       form.shift,
      jam_mulai:   form.jam_mulai,
      jam_selesai: form.jam_selesai,
      status:      form.status,
      notes:       form.notes.trim() || null,
    }

    const rows = form.staff_ids.flatMap((sid) =>
      hariList.map((h) => ({ ...base, staff_id: sid, hari: h })),
    )

    let error = null

    if (editId && form.staff_ids.length === 1 && hariList.length === 1) {
      const { error: e } = await supabase
        .from('schedules')
        .update({ ...rows[0] })
        .eq('id', editId)
      error = e
    } else {
      const { error: e } = await supabase
        .from('schedules')
        .upsert(rows, { onConflict: 'staff_id,hari' })
      error = e
    }

    if (error) { alert('Gagal menyimpan: ' + error.message); setSaving(false); return }
    setSaving(false)
    setShowSingle(false)
    setEditId(null)
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

  // ── Bulk delete ──────────────────────────────────────────────────────────────
  async function handleBulkDelete() {
    setBulkDeleting(true)
    await createClient().from('schedules').delete().in('id', selectedIds)
    setSelectedIds([])
    setBulkDeleting(false)
    load()
  }

  // ── Bulk edit ────────────────────────────────────────────────────────────────
  async function handleBulkEdit(patch: { shift: 'PAGI' | 'SORE'; jam_mulai: string; jam_selesai: string; status: 'AKTIF' | 'OFF' }) {
    setSaving(true)
    await createClient().from('schedules').update(patch).in('id', selectedIds)
    setSaving(false)
    setShowBulkEdit(false)
    setSelectedIds([])
    load()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Master Jadwal</h1>
          <p className="text-sm text-muted-foreground">Kelola jadwal kerja staff dan terapis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              title="Tampilan Tabel"
              className={[
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                viewMode === 'table'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              <LayoutList size={14} />
              <span className="hidden sm:inline">Tabel</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              title="Kalender Harian"
              className={[
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                viewMode === 'calendar'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              <CalendarDays size={14} />
              <span className="hidden sm:inline">Kalender</span>
            </button>
          </div>

          {viewMode === 'table' && (
            <>
              <button
                onClick={load}
                title="Refresh data"
                className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => setShowMonthly(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer text-foreground"
              >
                <CalendarRange size={15} /> Jadwal Mingguan
              </button>
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <Plus size={15} /> Tambah
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Calendar view ── */}
      {viewMode === 'calendar' && (
        <ScheduleCalendarView staffList={staffList} branches={branches} />
      )}

      {/* ── Table view ── */}
      {viewMode === 'table' && (
        <>
          <ScheduleStats
            total={total}
            totalMasuk={totalMasuk}
            totalOff={totalOff}
            loading={loading}
            onMasukClick={() => setStatusModal('AKTIF')}
            onOffClick={() => setStatusModal('OFF')}
          />

          <ScheduleFilters
            search={search}
            hariFilter={hariFilter}
            shiftFilter={shiftFilter}
            pageSize={pageSize}
            onSearch={(v) => { setSearch(v); setPage(0); setSelectedIds([]) }}
            onHari={(v) => { setHariFilter(v); setPage(0); setSelectedIds([]) }}
            onShift={(v) => { setShiftFilter(v); setPage(0); setSelectedIds([]) }}
            onPageSize={(v) => { setPageSize(v); setPage(0); setSelectedIds([]) }}
          />

          {/* ── Bulk action bar ── */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-primary" />
                <span className="text-sm font-medium text-foreground">
                  <span className="text-primary font-semibold">{selectedIds.length}</span> jadwal terpilih
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => setShowBulkEdit(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <Pencil size={12} /> Edit Terpilih
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF3B30] text-white text-xs font-medium hover:bg-[#FF3B30]/90 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {bulkDeleting
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />}
                  Hapus
                </button>
              </div>
            </div>
          )}

          <ScheduleTable
            rows={rows}
            loading={loading}
            page={page}
            pageSize={pageSize}
            total={total}
            search={search}
            hariFilter={hariFilter}
            shiftFilter={shiftFilter}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onEdit={openEdit}
            onDelete={setDeleteId}
            onPage={(p) => { setPage(p); setSelectedIds([]) }}
          />
        </>
      )}

      <ScheduleDialog
        key={editId ?? (showSingle ? 'new' : '')}
        open={showSingle}
        editId={editId}
        form={form}
        staffList={staffList}
        branches={branches}
        morningSlots={morningSlots}
        afternoonSlots={afternoonSlots}
        saving={saving}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onSave={handleSave}
        onClose={() => { setShowSingle(false); setEditId(null) }}
      />

      <MonthlyScheduleDialog
        open={showMonthly}
        staffList={staffList}
        branches={branches}
        onClose={() => setShowMonthly(false)}
        onSaved={() => { setShowMonthly(false); load() }}
      />

      <DeleteDialog
        open={!!deleteId}
        deleting={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />

      <BulkEditDialog
        open={showBulkEdit}
        count={selectedIds.length}
        saving={saving}
        onSave={handleBulkEdit}
        onClose={() => setShowBulkEdit(false)}
      />

      <StatusListModal
        open={!!statusModal}
        status={statusModal ?? 'AKTIF'}
        onClose={() => setStatusModal(null)}
      />
    </div>
  )
}
