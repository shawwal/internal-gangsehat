'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Plus, CalendarRange, LayoutList, CalendarDays } from 'lucide-react'
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
  const [viewMode, setViewMode]     = useState<ViewMode>('table')

  // ── Filters + pagination ─────────────────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [hariFilter, setHariFilter]   = useState('')
  const [shiftFilter, setShiftFilter] = useState('')
  const [pageSize, setPageSize]       = useState(10)
  const [page, setPage]               = useState(0)

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
      const [{ data: staff }, { data: br }] = await Promise.all([
        supabase
          .from('internal_profiles')
          .select('id, full_name, branch_id')
          .in('role', ['therapist', 'staff', 'manager'])
          .order('full_name'),
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
      ])
      setStaffList((staff ?? []) as StaffOption[])
      setBranches((br ?? []) as BranchOption[])
    }
    loadMeta()
  }, [])

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => { load() }, [page, pageSize, hariFilter, shiftFilter, search]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (hariFilter)  q = q.eq('hari', hariFilter)
      if (shiftFilter) q = q.eq('shift', shiftFilter)
      if (staffIds)    q = q.in('staff_id', staffIds)
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
      staff_id:    row.staff_id,
      branch_id:   row.branch_id ?? '',
      hari:        row.hari,
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
          <ScheduleStats total={total} totalMasuk={totalMasuk} totalOff={totalOff} loading={loading} />

          <ScheduleFilters
            search={search}
            hariFilter={hariFilter}
            shiftFilter={shiftFilter}
            pageSize={pageSize}
            onSearch={(v) => { setSearch(v); setPage(0) }}
            onHari={(v) => { setHariFilter(v); setPage(0) }}
            onShift={(v) => { setShiftFilter(v); setPage(0) }}
            onPageSize={(v) => { setPageSize(v); setPage(0) }}
          />

          <ScheduleTable
            rows={rows}
            loading={loading}
            page={page}
            pageSize={pageSize}
            total={total}
            search={search}
            hariFilter={hariFilter}
            shiftFilter={shiftFilter}
            onEdit={openEdit}
            onDelete={setDeleteId}
            onPage={setPage}
          />
        </>
      )}

      <ScheduleDialog
        open={showSingle}
        editId={editId}
        form={form}
        staffList={staffList}
        branches={branches}
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
    </div>
  )
}
