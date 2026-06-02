import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PayrollRecord, PayrollFiltersState, PayrollStats, SalarySetting } from '@/components/salary/types'
import type { PayrollEditFormState } from '@/components/salary/PayrollEditForm'
import { PAGE_SIZE, MONTHS } from '@/components/salary/types'

const now = new Date()

export const EMPTY_FORM: PayrollEditFormState = {
  base_salary: 0,
  transport_allowance: 0,
  meal_allowance: 0,
  other_allowance: 0,
  bonus_achievement: 0,
  deductions: 0,
  notes: '',
}

interface Params {
  role: string | null
  isManager: boolean
  userId: string | null
  settings: SalarySetting[]
  showToast: (msg: string) => void
}

export function usePayrollRecords({ role, isManager, userId, settings, showToast }: Params) {
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [stats, setStats] = useState<PayrollStats>({ total: 0, draft: 0, confirmed: 0, paid: 0 })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<PayrollFiltersState>({
    status: 'all',
    branchId: 'all',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  })

  // Form
  const [showForm, setShowForm] = useState(false)
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null)
  const [form, setForm] = useState<PayrollEditFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copying, setCopying] = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadRecords = useCallback(async () => {
    if (!role) return
    setLoading(true)
    const supabase = createClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let q = supabase
      .from('payroll_records')
      .select(
        'id, staff_id, branch_id, period_month, period_year, ' +
        'base_salary, transport_allowance, meal_allowance, other_allowance, ' +
        'bonus_achievement, deductions, notes, status, confirmed_by, confirmed_at, ' +
        'paid_at, transaction_id, created_at, updated_at, ' +
        'internal_profiles!staff_id(full_name, role), branches!branch_id(name)',
        { count: 'exact' }
      )
      .eq('period_month', filters.month)
      .eq('period_year', filters.year)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.status !== 'all') q = q.eq('status', filters.status)
    if (!isManager && filters.branchId !== 'all') q = q.eq('branch_id', filters.branchId)

    const { data, count, error } = await q
    setLoading(false)
    if (error) { showToast('Gagal memuat data'); return }

    setRecords((data ?? []) as unknown as PayrollRecord[])
    setTotal(count ?? 0)

    // Stats from a separate unbounded query (needed for correct counts when filter is active)
    let sq = supabase
      .from('payroll_records')
      .select('status')
      .eq('period_month', filters.month)
      .eq('period_year', filters.year)
    if (!isManager && filters.branchId !== 'all') sq = sq.eq('branch_id', filters.branchId)
    const { data: allRows } = await (sq as any).limit(2000)
    const rows: { status: string }[] = allRows ?? []
    setStats({
      total:     rows.length,
      draft:     rows.filter(r => r.status === 'draft').length,
      confirmed: rows.filter(r => r.status === 'confirmed').length,
      paid:      rows.filter(r => r.status === 'paid').length,
    })
  }, [role, isManager, page, filters, showToast])

  useEffect(() => { loadRecords() }, [loadRecords])

  // ── Optimistic helpers ────────────────────────────────────────────────────
  function patchRecord(id: string, patch: Partial<PayrollRecord>) {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function shiftStats(from: string, to: string) {
    if (from === to) return
    setStats(s => ({
      ...s,
      [from]: Math.max(0, (s[from as keyof PayrollStats] as number) - 1),
      [to]:   (s[to as keyof PayrollStats] as number) + 1,
    }))
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const record = records.find(r => r.id === id)
    if (!record) return

    // Snapshot before mutation
    const prevRecords = [...records]
    const prevStats = { ...stats }
    const prevTotal = total

    // Optimistic remove
    setRecords(prev => prev.filter(r => r.id !== id))
    setTotal(t => Math.max(0, t - 1))
    setStats(s => ({
      ...s,
      total:  Math.max(0, s.total - 1),
      [record.status]: Math.max(0, (s[record.status as keyof PayrollStats] as number) - 1),
    }))

    const supabase = createClient()
    const { error } = await supabase.from('payroll_records').delete().eq('id', id)

    if (error) {
      // Rollback
      setRecords(prevRecords)
      setTotal(prevTotal)
      setStats(prevStats)
      showToast('Gagal menghapus')
    } else {
      showToast('Record dihapus')
    }
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  async function handleConfirm(id: string) {
    const prevRecords = [...records]
    const prevStats = { ...stats }
    const ts = new Date().toISOString()

    patchRecord(id, { status: 'confirmed', confirmed_at: ts })
    shiftStats('draft', 'confirmed')

    const supabase = createClient()
    const { error } = await supabase
      .from('payroll_records')
      .update({ status: 'confirmed', confirmed_by: userId, confirmed_at: ts })
      .eq('id', id)

    if (error) {
      setRecords(prevRecords)
      setStats(prevStats)
      showToast('Gagal mengkonfirmasi')
    } else {
      showToast('Dikonfirmasi')
    }
  }

  // ── Mark paid ─────────────────────────────────────────────────────────────
  async function handleMarkPaid(id: string) {
    const prevRecords = [...records]
    const prevStats = { ...stats }
    const ts = new Date().toISOString()

    patchRecord(id, { status: 'paid', paid_at: ts })
    shiftStats('confirmed', 'paid')

    const supabase = createClient()
    const { error } = await supabase
      .from('payroll_records')
      .update({ status: 'paid', paid_at: ts })
      .eq('id', id)

    if (error) {
      setRecords(prevRecords)
      setStats(prevStats)
      showToast('Gagal mengubah status')
    } else {
      showToast('Ditandai sebagai dibayar')
    }
  }

  // ── Edit (save) ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editRecord) return

    const prevRecords = [...records]
    const patch = {
      base_salary:         form.base_salary,
      transport_allowance: form.transport_allowance,
      meal_allowance:      form.meal_allowance,
      other_allowance:     form.other_allowance,
      bonus_achievement:   form.bonus_achievement,
      deductions:          form.deductions,
      notes:               form.notes.trim() || null,
    }

    // Close form & patch UI immediately
    patchRecord(editRecord.id, patch)
    cancelForm()
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('payroll_records')
      .update(patch)
      .eq('id', editRecord.id)

    setSaving(false)
    if (error) {
      setRecords(prevRecords)
      showToast('Gagal menyimpan')
    } else {
      showToast('Record berhasil diperbarui')
    }
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!userId) return
    setGenerating(true)
    const supabase = createClient()

    const { data: staff } = await supabase
      .from('internal_profiles')
      .select('id, role, branch_id')
      .eq('is_active', true)

    if (!staff?.length) {
      showToast('Tidak ada karyawan aktif ditemukan')
      setGenerating(false)
      return
    }

    const { data: empSals } = await supabase
      .from('employee_salaries')
      .select('staff_id, base_salary, transport_allowance, meal_allowance, other_allowance')

    type EmpSalRow = {
      staff_id: string
      base_salary: number | null
      transport_allowance: number | null
      meal_allowance: number | null
      other_allowance: number
    }
    const overrideMap: Record<string, EmpSalRow> = {}
    for (const e of (empSals ?? []) as EmpSalRow[]) overrideMap[e.staff_id] = e

    const settingsMap: Record<string, SalarySetting> = {}
    for (const s of settings) settingsMap[s.role] = s

    const inserts = staff.map(s => {
      const over = overrideMap[s.id]
      const def  = settingsMap[s.role] ?? { base_salary: 0, transport_allowance: 0, meal_allowance: 0 }
      return {
        staff_id:            s.id,
        branch_id:           s.branch_id ?? null,
        period_month:        filters.month,
        period_year:         filters.year,
        base_salary:         over?.base_salary         ?? def.base_salary         ?? 0,
        transport_allowance: over?.transport_allowance ?? def.transport_allowance ?? 0,
        meal_allowance:      over?.meal_allowance       ?? def.meal_allowance       ?? 0,
        other_allowance:     over?.other_allowance      ?? 0,
        bonus_achievement:   0,
        deductions:          0,
        status:              'draft',
        created_by:          userId,
      }
    })

    const { error } = await supabase.from('payroll_records').insert(inserts)
    setGenerating(false)

    if (error) {
      showToast(error.code === '23505'
        ? 'Sebagian atau semua record sudah ada untuk periode ini'
        : 'Gagal generate: ' + error.message)
    } else {
      showToast(`${inserts.length} record draft berhasil dibuat`)
      loadRecords()
    }
  }

  // ── Copy from previous month ──────────────────────────────────────────────
  async function handleCopyFromPrev() {
    if (!userId) return
    setCopying(true)
    const supabase = createClient()

    const prevMonth = filters.month === 1 ? 12 : filters.month - 1
    const prevYear  = filters.month === 1 ? filters.year - 1 : filters.year

    const { data: prevRecords, error: fetchErr } = await supabase
      .from('payroll_records')
      .select('staff_id, branch_id, base_salary, transport_allowance, meal_allowance, other_allowance')
      .eq('period_month', prevMonth)
      .eq('period_year', prevYear)

    if (fetchErr || !prevRecords?.length) {
      showToast(fetchErr ? 'Gagal mengambil data bulan lalu' : `Tidak ada data di ${MONTHS[prevMonth - 1]} ${prevYear}`)
      setCopying(false)
      return
    }

    const inserts = prevRecords.map(r => ({
      staff_id:            r.staff_id,
      branch_id:           r.branch_id,
      period_month:        filters.month,
      period_year:         filters.year,
      base_salary:         r.base_salary,
      transport_allowance: r.transport_allowance,
      meal_allowance:      r.meal_allowance,
      other_allowance:     r.other_allowance,
      bonus_achievement:   0,
      deductions:          0,
      notes:               null,
      status:              'draft',
      created_by:          userId,
    }))

    const { error } = await supabase
      .from('payroll_records')
      .upsert(inserts, { onConflict: 'staff_id,period_month,period_year', ignoreDuplicates: true })

    setCopying(false)
    if (error) {
      showToast('Gagal menyalin: ' + error.message)
    } else {
      showToast(`${inserts.length} record disalin dari ${MONTHS[prevMonth - 1]} ${prevYear}`)
      loadRecords()
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function openEdit(r: PayrollRecord) {
    setEditRecord(r)
    setForm({
      base_salary:         r.base_salary,
      transport_allowance: r.transport_allowance,
      meal_allowance:      r.meal_allowance,
      other_allowance:     r.other_allowance,
      bonus_achievement:   r.bonus_achievement,
      deductions:          r.deductions,
      notes:               r.notes ?? '',
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditRecord(null)
    setForm(EMPTY_FORM)
  }

  function changeFilter(patch: Partial<PayrollFiltersState>) {
    setPage(0)
    setFilters(f => ({ ...f, ...patch }))
  }

  return {
    // Data
    records, stats, total, loading,
    // Pagination
    page, setPage,
    // Filters
    filters, changeFilter,
    // Form
    showForm, editRecord, form, setForm, saving,
    // Actions
    handleGenerate, handleCopyFromPrev, handleDelete, handleConfirm, handleMarkPaid, handleSubmit,
    openEdit, cancelForm,
    generating, copying,
  }
}
