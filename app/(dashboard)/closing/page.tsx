'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { TODAY_ISO } from '@/components/performance/utils'
import { BranchPicker } from '@/components/targetProgress/BranchPicker'
import type { BranchOption } from '@/components/targetProgress/types'
import {
  fetchClosingFinancialRecap,
  fetchClosingVisitRecap,
  type ClosingFinancialRecap,
  type ClosingVisitRecap,
} from '@/app/actions/closing'
import { createTransactionManual, deleteTransaction, updateTransaction } from '@/app/actions/transactions'
import { Skeleton, SkeletonRegion, FormSkeleton, StatCardsSkeleton } from '@/components/ui/Skeleton'

type Role = 'director' | 'manager' | 'finance' | 'hr' | 'marketing' | 'staff' | 'therapist' | 'admin' | null

const INCOME_CATEGORIES = ['TA KLINIK', 'PAKET KLINIK', 'SESI KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'TOKO', 'LAINNYA']
const EXPENSE_CATEGORIES = ['BEBAN PELAYANAN', 'GAJI', 'SEWA', 'LISTRIK', 'MARKETING', 'TUKAR TUNAI', 'LAINNYA']
const PAYMENT_METHODS = ['TUNAI', 'TRANSFER BCA', 'EDC BCA', 'TRANSFER BANK KALBAR']
const PAYMENT_STATUSES = ['LUNAS', 'DP', 'PELUNASAN']

function shiftISO(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateId(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Terjadwal',
  completed: 'Selesai',
  cancelled: 'Batal',
  no_show: 'Tidak Hadir',
}

const TX_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  confirmed: 'bg-[#34C759]/15 text-[#34C759]',
}
const TX_STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu Konfirmasi',
  confirmed: 'Dikonfirmasi',
}

export default function ClosingAdminPage() {
  const [role, setRole] = useState<Role>(null)
  const canPickBranch = role === 'director'
  const canEditCategory = role === 'director' || role === 'admin'
  const [savingTxId, setSavingTxId] = useState<string | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    payment_method: PAYMENT_METHODS[0],
    description: '',
  })

  const [branchList, setBranchList] = useState<BranchOption[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [selectedBranchName, setSelectedBranchName] = useState<string>('')
  const [dateFrom, setDateFrom] = useState(TODAY_ISO)
  const [dateTo, setDateTo] = useState(TODAY_ISO)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [financial, setFinancial] = useState<ClosingFinancialRecap | null>(null)
  const [visits, setVisits] = useState<ClosingVisitRecap | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('role, branch_id, branches!branch_id(name)')
        .eq('id', user.id)
        .single()
      if (!profile) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any
      setRole(p.role as Role)

      if (p.role === 'director') {
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        setBranchList((branchData ?? []) as BranchOption[])
      } else if (p.branch_id) {
        setSelectedBranchId(p.branch_id)
        setSelectedBranchName(p.branches?.name ?? '')
      }
    }
    init()
  }, [])

  const load = useCallback(async () => {
    if (!selectedBranchId) { setLoading(false); return }
    setLoading(true)
    const [fin, vis] = await Promise.all([
      fetchClosingFinancialRecap(selectedBranchId, dateFrom, dateTo),
      fetchClosingVisitRecap(selectedBranchId, dateFrom, dateTo),
    ])
    setFinancial(fin)
    setVisits(vis)
    setLoading(false)
  }, [selectedBranchId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  async function handleTxFieldChange(
    txId: string,
    field: 'category' | 'payment_method' | 'payment_status' | 'amount' | 'harga' | 'discount' | 'penjamin' | 'description',
    value: string,
  ) {
    setSavingTxId(txId)
    const patch = field === 'amount' || field === 'harga' || field === 'discount'
      ? { [field]: Number(value) || 0 }
      : { [field]: value || null }
    const { error } = await updateTransaction(txId, patch)
    setSavingTxId(null)
    await load()
    if (error) alert(error)
  }

  async function handleDeleteTx(txId: string) {
    if (!confirm('Hapus transaksi ini? Tindakan ini tidak bisa dibatalkan.')) return
    setDeletingTxId(txId)
    const { error } = await deleteTransaction(txId)
    setDeletingTxId(null)
    if (error) { alert(error); return }
    await load()
  }

  async function handleAddExpense() {
    if (!selectedBranchId) return
    const amount = Number(newExpense.amount)
    if (!amount || amount <= 0) { alert('Masukkan nominal yang valid'); return }
    setAddingExpense(true)
    const { error } = await createTransactionManual({
      type: 'expense',
      category: newExpense.category,
      harga: amount,
      amount,
      discount: 0,
      payment_method: newExpense.payment_method,
      payment_status: null,
      penjamin: null,
      description: newExpense.description || null,
      transaction_date: dateTo,
      branch_id: selectedBranchId,
    })
    setAddingExpense(false)
    if (error) { alert(error); return }
    setNewExpense({ category: EXPENSE_CATEGORIES[0], amount: '', payment_method: PAYMENT_METHODS[0], description: '' })
    setShowAddExpense(false)
    await load()
  }

  function handleBranchChange(id: string) {
    setSelectedBranchId(id)
    setSelectedBranchName(branchList.find((b) => b.id === id)?.name ?? '')
  }

  const dateLabel = dateFrom === dateTo
    ? formatDateId(dateFrom)
    : `${formatDateId(dateFrom)} – ${formatDateId(dateTo)}`

  function setRange(from: string, to: string) {
    setDateFrom(from)
    setDateTo(to)
  }

  const presets = [
    { label: 'Hari Ini', from: TODAY_ISO, to: TODAY_ISO },
    { label: 'Kemarin', from: shiftISO(TODAY_ISO, -1), to: shiftISO(TODAY_ISO, -1) },
    { label: '7 Hari', from: shiftISO(TODAY_ISO, -6), to: TODAY_ISO },
    { label: 'Bulan Ini', from: TODAY_ISO.slice(0, 8) + '01', to: TODAY_ISO },
  ]
  const inputCls = 'px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
  const cellInputCls = 'bg-transparent border border-border rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Closing Admin{selectedBranchName ? ` — ${selectedBranchName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">Rekap inputan sebelum log out — cek kesesuaian data hari ini</p>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground">Dari</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => e.target.value && setDateFrom(e.target.value)}
            className={inputCls}
          />
          <label className="text-xs text-muted-foreground">Sampai</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => e.target.value && setDateTo(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {presets.map((p) => {
            const active = p.from === dateFrom && p.to === dateTo
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setRange(p.from, p.to)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {canPickBranch && (
        <div className="glass-card p-4">
          <BranchPicker branches={branchList} selectedId={selectedBranchId} onChange={handleBranchChange} />
        </div>
      )}

      {!selectedBranchId ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <p className="text-sm font-medium text-foreground">Pilih cabang untuk melihat rekap closing</p>
        </div>
      ) : loading ? (
        <SkeletonRegion>
          <Skeleton className="h-3 w-40" />
          <FormSkeleton fields={6} />
          <StatCardsSkeleton count={3} className="grid grid-cols-1 sm:grid-cols-3 gap-4" />
        </SkeletonRegion>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">Rekap untuk {dateLabel}</p>

          {/* Financial recap */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Rekap Keuangan</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-muted/30">
                <p className="text-xs text-muted-foreground">Jumlah Pemasukan</p>
                <p className="text-lg font-semibold text-foreground">{formatCurrency(financial?.totalIncome ?? 0)}</p>
              </div>
              <div className="p-3 rounded-2xl bg-muted/30">
                <p className="text-xs text-muted-foreground">Jumlah Pengeluaran</p>
                <p className="text-lg font-semibold text-foreground">{formatCurrency(financial?.totalExpense ?? 0)}</p>
              </div>
              <div className="p-3 rounded-2xl bg-[#34C759]/10">
                <p className="text-xs text-muted-foreground">Cash Hari Ini</p>
                <p className="text-lg font-semibold text-[#34C759]">{formatCurrency(financial?.cashToday ?? 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Pemasukan per Metode Bayar</p>
                <div className="space-y-1.5">
                  {(financial?.incomeByMethod.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground/60">Tidak ada transaksi</p>
                  )}
                  {financial?.incomeByMethod.map((m) => (
                    <div key={m.payment_method} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{m.payment_method} ({m.count} kwitansi)</span>
                      <span className="font-medium text-foreground">{formatCurrency(m.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Layanan Masuk (per Kategori)</p>
                <div className="space-y-1.5">
                  {(financial?.incomeByCategory.length ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground/60">Tidak ada transaksi</p>
                  )}
                  {financial?.incomeByCategory.map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{c.category} ({c.count})</span>
                      <span className="font-medium text-foreground">{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {financial && financial.expenseByCategory.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Pengeluaran (per Kategori)</p>
                <div className="space-y-1.5">
                  {financial.expenseByCategory.map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{c.category} ({c.count})</span>
                      <span className="font-medium text-destructive">{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-foreground">Detail Transaksi</p>
                {canEditCategory && (
                  <button
                    type="button"
                    onClick={() => setShowAddExpense((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus size={13} /> Tambah Pengeluaran
                  </button>
                )}
              </div>

              {showAddExpense && (
                <div className="mb-3 p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      value={newExpense.category}
                      onChange={(e) => setNewExpense((s) => ({ ...s, category: e.target.value }))}
                      className="px-2 py-1.5 rounded-lg border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={newExpense.payment_method}
                      onChange={(e) => setNewExpense((s) => ({ ...s, payment_method: e.target.value }))}
                      className="px-2 py-1.5 rounded-lg border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input
                      type="number"
                      min={0}
                      placeholder="Nominal"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense((s) => ({ ...s, amount: e.target.value }))}
                      className="px-2 py-1.5 rounded-lg border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="text"
                      placeholder="Keterangan (opsional)"
                      value={newExpense.description}
                      onChange={(e) => setNewExpense((s) => ({ ...s, description: e.target.value }))}
                      className="px-2 py-1.5 rounded-lg border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddExpense(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={addingExpense}
                      onClick={handleAddExpense}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {addingExpense ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}

              {(financial?.transactions.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground/60">Tidak ada transaksi</p>
              ) : (
                <div className="space-y-1.5">
                  {financial!.transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-muted/30 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {canEditCategory ? (
                            <select
                              value={t.category}
                              disabled={savingTxId === t.id}
                              onChange={(e) => handleTxFieldChange(t.id, 'category', e.target.value)}
                              className="font-medium text-foreground bg-transparent border border-border rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            >
                              {(t.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-foreground">{t.category}</span>
                          )}
                          {canEditCategory ? (
                            <select
                              value={t.payment_method ?? PAYMENT_METHODS[0]}
                              disabled={savingTxId === t.id}
                              onChange={(e) => handleTxFieldChange(t.id, 'payment_method', e.target.value)}
                              className="text-muted-foreground bg-transparent border border-border rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            >
                              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          ) : (
                            t.payment_method && <span className="text-muted-foreground">· {t.payment_method}</span>
                          )}
                          {t.type === 'income' && (canEditCategory ? (
                            <select
                              value={t.payment_status ?? ''}
                              disabled={savingTxId === t.id}
                              onChange={(e) => handleTxFieldChange(t.id, 'payment_status', e.target.value)}
                              className={`text-muted-foreground ${cellInputCls}`}
                              aria-label="Jenis pembayaran"
                            >
                              <option value="">Jenis bayar —</option>
                              {PAYMENT_STATUSES.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          ) : (
                            t.payment_status && <span className="text-muted-foreground">· {t.payment_status}</span>
                          ))}
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${TX_STATUS_BADGE[t.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {TX_STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </div>
                        {t.patient_name && <p className="font-semibold text-foreground mt-1">{t.patient_name}</p>}
                        {canEditCategory ? (
                          <input
                            type="text"
                            key={`${t.id}-${t.description ?? ''}`}
                            defaultValue={t.description ?? ''}
                            placeholder="Keterangan layanan"
                            disabled={savingTxId === t.id}
                            onBlur={(e) => { if (e.target.value !== (t.description ?? '')) handleTxFieldChange(t.id, 'description', e.target.value) }}
                            className={`mt-1 w-full text-muted-foreground ${cellInputCls}`}
                          />
                        ) : (
                          t.description && <p className="text-muted-foreground/80 truncate mt-0.5">{t.description}</p>
                        )}
                      </div>
                      {canEditCategory ? (
                        <input
                          type="number"
                          min={0}
                          defaultValue={t.amount}
                          disabled={savingTxId === t.id}
                          onBlur={(e) => {
                            const v = e.target.value
                            if (Number(v) !== t.amount) handleTxFieldChange(t.id, 'amount', v)
                          }}
                          className={`shrink-0 w-24 text-right font-semibold bg-transparent border border-border rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${t.type === 'income' ? 'text-[#34C759]' : 'text-destructive'}`}
                        />
                      ) : (
                        <span className={`shrink-0 font-semibold ${t.type === 'income' ? 'text-[#34C759]' : 'text-destructive'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      )}
                      {canEditCategory && (
                        <button
                          type="button"
                          disabled={deletingTxId === t.id}
                          onClick={() => handleDeleteTx(t.id)}
                          className="shrink-0 p-1.5 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          aria-label="Hapus transaksi"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Visit recap */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Rekap Kunjungan</h2>


            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">{visits?.total ?? 0} kunjungan</span>
              {visits?.byStatus.map(({ status, count }) => (
                <span key={status} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                  {count} {STATUS_LABEL[status] ?? status}
                </span>
              ))}
            </div>

            {visits && visits.incomplete.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#FFB35C]">
                  <AlertTriangle size={13} />
                  {visits.incomplete.length} rekam medis belum lengkap
                </div>
                <div className="space-y-1.5">
                  {visits.incomplete.map((v) => (
                    <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFB35C]/10 text-xs">
                      <span className="text-foreground font-medium">{v.patient_name}</span>
                      <span className="text-muted-foreground">{v.service_type ?? '—'} · {v.attending_staff_name ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Daftar Kunjungan &amp; Pembayaran</p>
              {(visits?.visits.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground/60">Tidak ada kunjungan</p>
              ) : (
                <div className="space-y-1.5">
                  {visits!.visits.map((v) => {
                    const open = expandedVisitId === v.id
                    const paid = v.payments.reduce((s, p) => s + p.amount, 0)
                    return (
                      <div key={v.id} className="rounded-xl bg-muted/30 text-xs">
                        <button
                          type="button"
                          onClick={() => setExpandedVisitId(open ? null : v.id)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span className="font-medium text-foreground truncate">{v.patient_name}</span>
                            <span className="text-muted-foreground truncate">
                              {dateFrom !== dateTo && `${formatDateId(v.visit_date)} · `}{v.service_type ?? '—'} · {v.attending_staff_name ?? '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{STATUS_LABEL[v.status] ?? v.status}</span>
                            {v.payments.length === 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#FFB35C]/15 text-[#FFB35C] font-semibold">Belum ada pembayaran</span>
                            ) : (
                              <span className="font-semibold text-[#34C759]">{formatCurrency(paid)}</span>
                            )}
                          </div>
                        </button>

                        {open && (
                          <div className="px-3 pb-3 space-y-2">
                            {v.payments.length === 0 && (
                              <p className="text-muted-foreground/60 pl-6">Tidak ada transaksi terhubung ke kunjungan ini</p>
                            )}
                            {v.payments.map((p) => {
                              const busy = savingTxId === p.id
                              return (
                                <div key={p.id} className="ml-6 p-2.5 rounded-lg border border-border space-y-2">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <Field label="Kategori">
                                      {canEditCategory ? (
                                        <select value={p.category} disabled={busy} onChange={(e) => handleTxFieldChange(p.id, 'category', e.target.value)} className={cellInputCls}>
                                          {INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      ) : <span className="text-foreground">{p.category}</span>}
                                    </Field>
                                    <Field label="Metode Bayar">
                                      {canEditCategory ? (
                                        <select value={p.payment_method ?? ''} disabled={busy} onChange={(e) => handleTxFieldChange(p.id, 'payment_method', e.target.value)} className={cellInputCls}>
                                          <option value="">—</option>
                                          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                      ) : <span className="text-foreground">{p.payment_method ?? '—'}</span>}
                                    </Field>
                                    <Field label="Jenis Pembayaran">
                                      {canEditCategory ? (
                                        <select value={p.payment_status ?? ''} disabled={busy} onChange={(e) => handleTxFieldChange(p.id, 'payment_status', e.target.value)} className={cellInputCls}>
                                          <option value="">—</option>
                                          {PAYMENT_STATUSES.map((m) => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                      ) : <span className="text-foreground">{p.payment_status ?? '—'}</span>}
                                    </Field>
                                    <Field label="Penjamin">
                                      {canEditCategory ? (
                                        <input type="text" defaultValue={p.penjamin ?? ''} disabled={busy}
                                          onBlur={(e) => { if (e.target.value !== (p.penjamin ?? '')) handleTxFieldChange(p.id, 'penjamin', e.target.value) }}
                                          className={cellInputCls} />
                                      ) : <span className="text-foreground">{p.penjamin ?? '—'}</span>}
                                    </Field>
                                    {(['harga', 'discount', 'amount'] as const).map((f) => (
                                      <Field key={f} label={f === 'harga' ? 'Harga' : f === 'discount' ? 'Diskon' : 'Dibayar'}>
                                        {canEditCategory ? (
                                          <input type="number" min={0} defaultValue={p[f]} disabled={busy}
                                            onBlur={(e) => { if (Number(e.target.value) !== p[f]) handleTxFieldChange(p.id, f, e.target.value) }}
                                            className={`${cellInputCls} text-right`} />
                                        ) : <span className="text-foreground">{formatCurrency(p[f])}</span>}
                                      </Field>
                                    ))}
                                    <Field label="Sisa">
                                      <span className={p.outstanding > 0 ? 'font-semibold text-destructive' : 'text-foreground'}>{formatCurrency(p.outstanding)}</span>
                                    </Field>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    {canEditCategory ? (
                                      <input type="text" defaultValue={p.description ?? ''} placeholder="Keterangan layanan" disabled={busy}
                                        onBlur={(e) => { if (e.target.value !== (p.description ?? '')) handleTxFieldChange(p.id, 'description', e.target.value) }}
                                        className={`flex-1 ${cellInputCls}`} />
                                    ) : (
                                      <span className="text-muted-foreground/80 truncate">{p.description ?? ''}</span>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${TX_STATUS_BADGE[p.status] ?? 'bg-muted text-muted-foreground'}`}>
                                      {TX_STATUS_LABEL[p.status] ?? p.status}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
