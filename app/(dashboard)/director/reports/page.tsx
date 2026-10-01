'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, XCircle, Clock, Eye, Plus, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/excel-export'
import { logActivity } from '@/lib/activityLog'
import { computeReportTotals } from '@/lib/financialReports'
import type { BranchFinancialReport, ReportStatus } from '@/types'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface Report extends BranchFinancialReport {
  branches: { name: string } | null
  submitter: { full_name: string } | null
  reviewer: { full_name: string } | null
}

interface Branch {
  id: string
  name: string
}

type ReviewAction = 'approved' | 'rejected'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function periodLabel(r: { period_month: number; period_year: number }) {
  return `${MONTH_NAMES[r.period_month - 1]} ${r.period_year}`
}

const STATUS_BADGE: Record<ReportStatus, string> = {
  draft:     'bg-muted text-muted-foreground',
  submitted: 'bg-secondary/20 text-secondary-foreground',
  approved:  'bg-chart-4/15 text-chart-4',
  rejected:  'bg-destructive/10 text-destructive',
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  draft:     'Draft',
  submitted: 'Menunggu',
  approved:  'Disetujui',
  rejected:  'Ditolak',
}

const INPUT_CLASS = 'px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

const now = new Date()

export default function DirectorReportsPage() {
  const [reports, setReports]   = useState<Report[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [yearFilter, setYearFilter]     = useState('all')

  const [detailId, setDetailId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [action, setAction]     = useState<ReviewAction | null>(null)
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ branchId: '', year: now.getFullYear(), month: now.getMonth() + 1 })

  async function load() {
    const supabase = createClient()
    const [reportsRes, branchesRes] = await Promise.all([
      supabase
        .from('branch_financial_reports')
        .select('*, branches!branch_id(name), submitter:internal_profiles!submitted_by(full_name), reviewer:internal_profiles!reviewed_by(full_name)')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false }),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setError(reportsRes.error?.message ?? null)
    setReports((reportsRes.data ?? []) as unknown as Report[])
    setBranches((branchesRes.data ?? []) as Branch[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const years = useMemo(
    () => [...new Set(reports.map((r) => r.period_year))].sort((a, b) => b - a),
    [reports],
  )

  const filtered = useMemo(
    () => reports.filter((r) =>
      (statusFilter === 'all' || r.status === statusFilter) &&
      (branchFilter === 'all' || r.branch_id === branchFilter) &&
      (yearFilter === 'all' || r.period_year === Number(yearFilter))),
    [reports, statusFilter, branchFilter, yearFilter],
  )

  const stats = useMemo(() => {
    const approved = filtered.filter((r) => r.status === 'approved')
    return {
      pending:   filtered.filter((r) => r.status === 'submitted').length,
      approved:  approved.length,
      rejected:  filtered.filter((r) => r.status === 'rejected').length,
      netProfit: approved.reduce((s, r) => s + Number(r.net_profit), 0),
    }
  }, [filtered])

  const detail = reports.find((r) => r.id === detailId) ?? null

  function openReview(id: string, next: ReviewAction) {
    setDetailId(null)
    setReviewId(id)
    setAction(next)
    setNote('')
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewId || !action) return
    const oldRow = reports.find((r) => r.id === reviewId)
    if (!oldRow) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const newValues = {
      status: action,
      notes: note.trim() || null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }
    // Guard on status so a report already reviewed elsewhere isn't overwritten.
    const { data, error: updateError } = await supabase
      .from('branch_financial_reports')
      .update(newValues)
      .eq('id', reviewId)
      .eq('status', 'submitted')
      .select('id')
    setSaving(false)
    if (updateError || !data?.length) {
      alert('Gagal menyimpan: ' + (updateError?.message ?? 'laporan sudah tidak berstatus menunggu.'))
      load()
      return
    }
    await logActivity({
      supabase,
      userId: user?.id,
      action: 'update',
      resourceType: 'branch_financial_report',
      resourceId: reviewId,
      resourceLabel: `${oldRow.branches?.name ?? ''} — ${periodLabel(oldRow)}`,
      branchId: oldRow.branch_id,
      oldValues: { status: oldRow.status, notes: oldRow.notes },
      newValues: { status: action, notes: newValues.notes },
    })
    setReviewId(null)
    setNote('')
    load()
  }

  // Puts an approved/rejected report back in the review queue.
  async function handleReopen(r: Report) {
    if (!confirm(`Batalkan keputusan untuk laporan ${r.branches?.name ?? ''} ${periodLabel(r)}?`)) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: updateError } = await supabase
      .from('branch_financial_reports')
      .update({ status: 'submitted', reviewed_by: null, reviewed_at: null })
      .eq('id', r.id)
    setSaving(false)
    if (updateError) {
      alert('Gagal menyimpan: ' + updateError.message)
      return
    }
    await logActivity({
      supabase,
      userId: user?.id,
      action: 'update',
      resourceType: 'branch_financial_report',
      resourceId: r.id,
      resourceLabel: `${r.branches?.name ?? ''} — ${periodLabel(r)}`,
      branchId: r.branch_id,
      oldValues: { status: r.status },
      newValues: { status: 'submitted' },
    })
    load()
  }

  // Builds (or refreshes) a branch's report from its confirmed transactions,
  // for periods the branch has not submitted itself.
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.branchId) return
    const existing = reports.find((r) =>
      r.branch_id === form.branchId && r.period_year === form.year && r.period_month === form.month)
    if (existing?.status === 'approved') {
      alert('Laporan periode ini sudah disetujui. Batalkan keputusannya dulu untuk menghitung ulang.')
      return
    }
    if (existing && !confirm('Laporan periode ini sudah ada. Hitung ulang dari transaksi?')) return

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    try {
      const totals = await computeReportTotals(supabase, form.branchId, form.year, form.month)
      const newValues = {
        branch_id:    form.branchId,
        period_year:  form.year,
        period_month: form.month,
        ...totals,
        status:       'submitted' as const,
        submitted_by: user?.id ?? null,
        submitted_at: new Date().toISOString(),
        reviewed_by:  null,
        reviewed_at:  null,
      }
      const { data, error: upsertError } = await supabase
        .from('branch_financial_reports')
        .upsert(newValues, { onConflict: 'branch_id,period_year,period_month' })
        .select('id')
        .single()
      if (upsertError) throw new Error(upsertError.message)
      await logActivity({
        supabase,
        userId: user?.id,
        action: existing ? 'update' : 'create',
        resourceType: 'branch_financial_report',
        resourceId: data.id,
        resourceLabel: `${branches.find((b) => b.id === form.branchId)?.name ?? ''} — ${periodLabel(newValues)}`,
        branchId: form.branchId,
        oldValues: existing ? { status: existing.status, total_income: existing.total_income, total_expense: existing.total_expense } : null,
        newValues: { status: 'submitted', ...totals },
      })
      setShowForm(false)
      load()
    } catch (err) {
      alert('Gagal membuat laporan: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleExportReports() {
    exportToExcel(filtered, [
      { header: 'Cabang',            value: (r) => r.branches?.name ?? '' },
      { header: 'Periode',           value: (r) => periodLabel(r) },
      { header: 'Bulan',             value: (r) => r.period_month },
      { header: 'Tahun',             value: (r) => r.period_year },
      { header: 'Total Pemasukan',   value: (r) => r.total_income },
      { header: 'Total Pengeluaran', value: (r) => r.total_expense },
      { header: 'Net Profit',        value: (r) => r.net_profit },
      { header: 'Pasien',            value: (r) => r.patient_count },
      { header: 'Kunjungan',         value: (r) => r.visit_count },
      { header: 'Status',            value: (r) => STATUS_LABEL[r.status] },
      { header: 'Catatan',           value: (r) => r.notes ?? '' },
      { header: 'Dikirim Oleh',      value: (r) => r.submitter?.full_name ?? '' },
      { header: 'Dikirim',           value: (r) => r.submitted_at?.slice(0, 10) ?? '' },
      { header: 'Ditinjau Oleh',     value: (r) => r.reviewer?.full_name ?? '' },
      { header: 'Ditinjau',          value: (r) => r.reviewed_at?.slice(0, 10) ?? '' },
    ], `laporan_keuangan_${new Date().toISOString().slice(0, 10)}`)
    return Promise.resolve()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Laporan Bulanan</h1>
          <p className="text-sm text-muted-foreground">Tinjau dan setujui laporan keuangan cabang</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && filtered.length > 0 && (
            <ExportButton onExport={handleExportReports} />
          )}
          <button
            onClick={() => { setForm((f) => ({ ...f, branchId: f.branchId || branches[0]?.id || '' })); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Buat Laporan
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
          Gagal memuat laporan: {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Menunggu Tinjauan</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Disetujui</p>
          <p className="text-2xl font-semibold text-chart-4 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Ditolak</p>
          <p className="text-2xl font-semibold text-destructive mt-1">{stats.rejected}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Net Profit Disetujui</p>
          <p className={`text-lg font-semibold mt-1 ${stats.netProfit >= 0 ? 'text-chart-4' : 'text-destructive'}`}>
            {formatRp(stats.netProfit)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReportStatus | 'all')} className={INPUT_CLASS}>
          <option value="all">Semua status</option>
          {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={INPUT_CLASS}>
          <option value="all">Semua cabang</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={INPUT_CLASS}>
          <option value="all">Semua tahun</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cabang</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Periode</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pemasukan</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pengeluaran</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Net Profit</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{r.branches?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{periodLabel(r)}</td>
                  <td className="px-4 py-3 text-right text-chart-4 whitespace-nowrap">{formatRp(r.total_income)}</td>
                  <td className="px-4 py-3 text-right text-destructive whitespace-nowrap">{formatRp(r.total_expense)}</td>
                  <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${r.net_profit >= 0 ? 'text-chart-4' : 'text-destructive'}`}>
                    {formatRp(r.net_profit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'draft' && <Clock size={14} className="text-muted-foreground mr-1" />}
                      {r.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => openReview(r.id, 'approved')}
                            className="p-1.5 rounded-lg hover:bg-chart-4/10 text-chart-4 transition-colors"
                            title="Setujui"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => openReview(r.id, 'rejected')}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                            title="Tolak"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setDetailId(r.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        title="Detail"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {reports.length ? 'Tidak ada laporan yang cocok dengan filter.' : 'Belum ada laporan.'}
            </p>
          )}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailId(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{detail.branches?.name ?? '—'}</h2>
                <p className="text-sm text-muted-foreground">{periodLabel(detail)}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[detail.status]}`}>
                {STATUS_LABEL[detail.status]}
              </span>
            </div>

            <dl className="text-sm divide-y divide-border">
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Pemasukan</dt>
                <dd className="text-chart-4">{formatRp(detail.total_income)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Pengeluaran</dt>
                <dd className="text-destructive">{formatRp(detail.total_expense)}</dd>
              </div>
              <div className="flex justify-between py-2 font-medium">
                <dt className="text-foreground">Net Profit</dt>
                <dd className={detail.net_profit >= 0 ? 'text-chart-4' : 'text-destructive'}>{formatRp(detail.net_profit)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Pasien / Kunjungan</dt>
                <dd className="text-foreground">{detail.patient_count} pasien · {detail.visit_count} kunjungan</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Dikirim</dt>
                <dd className="text-foreground text-right">
                  {detail.submitter?.full_name ?? '—'}
                  <span className="block text-xs text-muted-foreground">{formatDateTime(detail.submitted_at)}</span>
                </dd>
              </div>
              {detail.reviewed_at && (
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Ditinjau</dt>
                  <dd className="text-foreground text-right">
                    {detail.reviewer?.full_name ?? '—'}
                    <span className="block text-xs text-muted-foreground">{formatDateTime(detail.reviewed_at)}</span>
                  </dd>
                </div>
              )}
              {detail.notes && (
                <div className="py-2">
                  <dt className="text-muted-foreground mb-1">Catatan</dt>
                  <dd className="text-foreground whitespace-pre-wrap">{detail.notes}</dd>
                </div>
              )}
            </dl>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDetailId(null)}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Tutup
              </button>
              {detail.status === 'submitted' && (
                <>
                  <button
                    onClick={() => openReview(detail.id, 'rejected')}
                    className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-destructive hover:bg-destructive/90 transition-colors"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => openReview(detail.id, 'approved')}
                    className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-chart-4 hover:bg-chart-4/90 transition-colors"
                  >
                    Setujui
                  </button>
                </>
              )}
              {(detail.status === 'approved' || detail.status === 'rejected') && (
                <button
                  onClick={() => handleReopen(detail)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 transition-colors"
                >
                  <RotateCcw size={14} /> Batalkan Keputusan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {reviewId && action && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-1">
              {action === 'approved' ? 'Setujui Laporan' : 'Tolak Laporan'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {action === 'approved' ? 'Tambahkan catatan (opsional)' : 'Tuliskan alasan penolakan untuk cabang'}
            </p>
            <form onSubmit={handleReview} className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                required={action === 'rejected'}
                placeholder="Catatan..."
                className={`w-full resize-none ${INPUT_CLASS}`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewId(null)}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-colors ${action === 'approved' ? 'bg-chart-4 hover:bg-chart-4/90' : 'bg-destructive hover:bg-destructive/90'}`}
                >
                  {saving ? 'Menyimpan...' : action === 'approved' ? 'Setujui' : 'Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-1">Buat Laporan Bulanan</h2>
            <p className="text-sm text-muted-foreground mb-4">Dihitung dari transaksi terkonfirmasi dan kunjungan cabang pada periode tersebut.</p>
            <form onSubmit={handleGenerate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Cabang</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  required
                  className={`w-full ${INPUT_CLASS}`}
                >
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Bulan</label>
                  <select
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                    className={`w-full ${INPUT_CLASS}`}
                  >
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tahun</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                    className={`w-full ${INPUT_CLASS}`}
                  />
                </div>
              </div>
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
                  disabled={saving || !form.branchId}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Memproses...' : 'Buat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
