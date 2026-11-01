'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Dumbbell, HeartPulse, Plus, Send, Trash2, Wallet, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { TODAY_ISO } from '@/components/performance/utils'
import { BranchPicker } from '@/components/targetProgress/BranchPicker'
import type { BranchOption } from '@/components/targetProgress/types'
import {
  fetchClosingFinancialRecap,
  fetchClosingSubmission,
  fetchClosingVisitRecap,
  reviewClosing,
  submitClosing,
  type ClosingFinancialRecap,
  type ClosingSubmission,
  type ClosingUnitRecap,
  type ClosingVisitItem,
  type ClosingVisitRecap,
} from '@/app/actions/closing'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import { useToast } from '@/context/ToastContext'
import { createTransactionManual, deleteTransaction, updateTransaction } from '@/app/actions/transactions'
import { fetchLayananByBranch } from '@/app/actions/layanan'
import { branchIncomeKategori } from '@/lib/serviceType'
import { Skeleton, SkeletonRegion, FormSkeleton, StatCardsSkeleton } from '@/components/ui/Skeleton'
import { PaymentProofField, PaymentProofLink } from '@/components/payments/PaymentProofField'
import { PaymentProofDialog } from '@/components/payments/PaymentProofDialog'
import { PAYMENT_PROOF_REQUIRED_MSG, isGatewayPayment, requiresPaymentProof } from '@/lib/paymentProof'

type Role = 'director' | 'manager' | 'finance' | 'hr' | 'marketing' | 'staff' | 'therapist' | 'admin' | null

const EXPENSE_CATEGORIES = ['BEBAN PELAYANAN', 'GAJI', 'SEWA', 'LISTRIK', 'MARKETING', 'TUKAR TUNAI', 'LAINNYA']
// Salaries are visible to director / finance only (the server leaves them out for everyone else).
const SALARY_ROLES: Role[] = ['director', 'finance']
const PAYMENT_METHODS = ['TUNAI', 'TRANSFER BCA', 'EDC BCA', 'TRANSFER BANK KALBAR']
const PAYMENT_STATUSES = ['LUNAS', 'DP', 'CICILAN', 'PELUNASAN']

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
  rescheduled: 'Reschedule',
}

const SUBMISSION_BADGE: Record<ClosingSubmission['status'], { label: string; cls: string }> = {
  submitted: { label: 'Menunggu Finance', cls: 'bg-[#FFB35C]/15 text-[#FFB35C]' },
  approved:  { label: 'Disetujui Finance', cls: 'bg-[#34C759]/15 text-[#34C759]' },
  rejected:  { label: 'Ditolak Finance', cls: 'bg-destructive/15 text-destructive' },
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
  const { showToast } = useToast()
  const [role, setRole] = useState<Role>(null)
  const canPickBranch = role === 'director'
  const canSeeSalary = SALARY_ROLES.includes(role)
  const expenseCategories = canSeeSalary ? EXPENSE_CATEGORIES : EXPENSE_CATEGORIES.filter((c) => c !== 'GAJI')
  const [savingTxId, setSavingTxId] = useState<string | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    payment_method: PAYMENT_METHODS[0],
    description: '',
    receipt_url: null as string | null,
  })
  const [expenseProofUploading, setExpenseProofUploading] = useState(false)
  // Transfer proof prompt: switching a row to a transfer method inline, or
  // attaching a proof to an existing transfer row.
  const [proofPrompt, setProofPrompt] = useState<{ txId: string; method: string; switchMethod: boolean } | null>(null)

  const [branchList, setBranchList] = useState<BranchOption[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [selectedBranchName, setSelectedBranchName] = useState<string>('')
  const [dateFrom, setDateFrom] = useState(TODAY_ISO)
  const [dateTo, setDateTo] = useState(TODAY_ISO)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [financial, setFinancial] = useState<ClosingFinancialRecap | null>(null)
  const [visits, setVisits] = useState<ClosingVisitRecap | null>(null)
  const [showTxDetail, setShowTxDetail] = useState(false)

  // Submit → Finance approval, per branch per single day
  const [submission, setSubmission] = useState<ClosingSubmission | null>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const singleDay = dateFrom === dateTo
  const approved = singleDay && submission?.status === 'approved'
  // An approved day is final: only director keeps editing it.
  const canEditCategory = role === 'director' || (role === 'admin' && !approved)
  const canSubmit = (role === 'admin' || role === 'manager' || role === 'director') && singleDay && !approved
  const canReview = (role === 'finance' || role === 'director') && singleDay && submission?.status === 'submitted'

  useEffect(() => {
    // Deep link from the notification: /closing?date=YYYY-MM-DD
    const fromUrl = new URLSearchParams(window.location.search).get('date')
    if (fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)) { setDateFrom(fromUrl); setDateTo(fromUrl) }
  }, [])

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
    const [fin, vis, sub] = await Promise.all([
      fetchClosingFinancialRecap(selectedBranchId, dateFrom, dateTo),
      fetchClosingVisitRecap(selectedBranchId, dateFrom, dateTo),
      dateFrom === dateTo ? fetchClosingSubmission(selectedBranchId, dateFrom) : Promise.resolve(null),
    ])
    setFinancial(fin)
    setVisits(vis)
    setSubmission(sub)
    setLoading(false)
  }, [selectedBranchId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  // Income re-categorisation offers only what this branch's Tarif Layanan sells
  // (plus the row's own current category, so an old row still renders).
  const [incomeCats, setIncomeCats] = useState<string[]>([])
  useEffect(() => {
    if (!selectedBranchId) return
    let cancelled = false
    fetchLayananByBranch(selectedBranchId).then((rows) => { if (!cancelled) setIncomeCats(branchIncomeKategori(rows)) })
    return () => { cancelled = true }
  }, [selectedBranchId])
  const incomeOptions = (current: string) => incomeCats.includes(current) ? incomeCats : [current, ...incomeCats]

  async function handleTxFieldChange(
    txId: string,
    field: 'category' | 'payment_method' | 'payment_status' | 'amount' | 'harga' | 'discount' | 'penjamin' | 'description',
    value: string,
  ) {
    if (field === 'payment_method' && requiresPaymentProof(value) && !findTxProof(txId)) {
      setProofPrompt({ txId, method: value, switchMethod: true })
      return
    }
    setSavingTxId(txId)
    const patch = field === 'amount' || field === 'harga' || field === 'discount'
      ? { [field]: Number(value) || 0 }
      : { [field]: value || null }
    const { error } = await updateTransaction(txId, patch)
    setSavingTxId(null)
    await load()
    if (error) alert(error)
  }

  function findTxProof(txId: string): string | null {
    const tx = financial?.transactions.find((t) => t.id === txId)
      ?? [...(visits?.fisioterapi.visits ?? []), ...(visits?.sportMassage.visits ?? [])]
        .flatMap((v) => v.payments).find((p) => p.id === txId)
    return tx?.receipt_url ?? null
  }

  async function saveProofPrompt(path: string): Promise<string | null> {
    if (!proofPrompt) return null
    const { txId, method, switchMethod } = proofPrompt
    setSavingTxId(txId)
    const { error } = await updateTransaction(txId, switchMethod ? { payment_method: method, receipt_url: path } : { receipt_url: path })
    setSavingTxId(null)
    if (error) return error
    setProofPrompt(null)
    await load()
    return null
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
    if (expenseProofUploading) return
    const needsProof = requiresPaymentProof(newExpense.payment_method)
    if (needsProof && !newExpense.receipt_url) { alert(PAYMENT_PROOF_REQUIRED_MSG); return }
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
      receipt_url: needsProof ? newExpense.receipt_url : null,
    })
    setAddingExpense(false)
    if (error) { alert(error); return }
    setNewExpense({ category: EXPENSE_CATEGORIES[0], amount: '', payment_method: PAYMENT_METHODS[0], description: '', receipt_url: null })
    setShowAddExpense(false)
    await load()
  }

  async function handleSubmitClosing() {
    if (!selectedBranchId) return
    setWorkflowBusy(true)
    const { error } = await submitClosing(selectedBranchId, dateFrom, {
      totalIncome:  financial?.totalIncome ?? 0,
      totalExpense: financial?.totalExpense ?? 0,
      cashToday:    financial?.cashToday ?? 0,
      visitsHadir:  (visits?.fisioterapi.stats.hadir ?? 0) + (visits?.sportMassage.stats.hadir ?? 0),
    })
    setWorkflowBusy(false)
    setConfirmSubmit(false)
    if (error) { showToast(error, 'error'); return }
    showToast('Closing berhasil diajukan — menunggu persetujuan Finance', 'success')
    await load()
  }

  async function handleReview(approve: boolean) {
    if (!selectedBranchId) return
    setWorkflowBusy(true)
    const { error } = await reviewClosing(selectedBranchId, dateFrom, approve, rejectNote)
    setWorkflowBusy(false)
    if (error) { showToast(error, 'error'); return }
    setConfirmApprove(false)
    setRejecting(false)
    setRejectNote('')
    showToast(approve ? 'Closing disetujui — data hari ini final' : 'Closing ditolak — admin akan memperbaiki data', 'success')
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

  const UNIT_TILE_COLS: Record<number, string> = { 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7' }

  /** One unit's visit recap: stat cards, incomplete records per therapist, visit list. */
  function renderUnitSection(title: string, icon: React.ReactNode, unit: ClosingUnitRecap | undefined, sportMassage: boolean) {
    const st = unit?.stats
    const tiles: { label: string; value: number; hint?: string; tone?: 'green' | 'red' | 'orange' }[] = [
      { label: 'Jumlah Kunjungan', value: st?.hadir ?? 0, hint: 'Hadir', tone: 'green' },
      { label: 'Paket', value: st?.paket ?? 0, hint: 'Hadir' },
      { label: 'Sesi', value: st?.sesi ?? 0, hint: 'Hadir' },
      ...(sportMassage ? [] : [{ label: 'Terapi Awal', value: st?.terapiAwal ?? 0, hint: 'Hadir' }]),
      { label: 'Jumlah Booking', value: st?.booking ?? 0, hint: 'Terjadwal' },
      { label: 'Jumlah Tidak Hadir', value: st?.tidakHadir ?? 0, hint: st?.deleted ? `termasuk ${st.deleted} dihapus` : 'Tdk Hadir / dihapus', tone: 'red' },
      { label: 'Rekam Medis Belum Lengkap', value: st?.incomplete ?? 0, tone: 'orange' },
    ]
    const toneCls = { green: 'bg-[#34C759]/10 text-[#34C759]', red: 'bg-destructive/10 text-destructive', orange: 'bg-[#FFB35C]/10 text-[#FFB35C]' }
    return (
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>

        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${UNIT_TILE_COLS[tiles.length] ?? ''}`}>
          {tiles.map((t) => (
            <div key={t.label} className={`p-3 rounded-2xl ${t.tone && t.value > 0 ? toneCls[t.tone].split(' ')[0] : 'bg-muted/30'}`}>
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={`text-lg font-semibold ${t.tone && t.value > 0 ? toneCls[t.tone].split(' ')[1] : 'text-foreground'}`}>{t.value}</p>
              {t.hint && <p className="text-[10px] text-muted-foreground/70">{t.hint}</p>}
            </div>
          ))}
        </div>

        {unit && unit.incompleteByTherapist.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#FFB35C]">
                <AlertTriangle size={13} />
                Terapis dengan rekam medis belum lengkap
              </div>
              <Link href="/medical-records?completeness=incomplete" className="text-xs font-medium text-primary hover:underline">
                Buka Rekam Medis
              </Link>
            </div>
            <div className="space-y-1.5">
              {unit.incompleteByTherapist.map((t) => (
                <div key={t.staff_id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#FFB35C]/10 text-xs">
                  <span className="text-foreground font-medium">{t.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFB35C]/15 text-[#FFB35C] font-semibold">{t.count} belum lengkap</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Daftar Kunjungan &amp; Pembayaran</p>
          {renderVisitList(unit?.visits ?? [])}
        </div>
      </div>
    )
  }

  function renderVisitList(list: ClosingVisitItem[]) {
    return (
      <>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">Tidak ada kunjungan</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((v) => {
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
                    {v.kehadiran && (
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${v.kehadiran === 'HADIR' ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-destructive/15 text-destructive'}`}>
                    {v.kehadiran === 'HADIR' ? 'Hadir' : 'Tidak Hadir'}
                  </span>
                )}
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
                                  {incomeOptions(p.category).map((c) => <option key={c} value={c}>{c}</option>)}
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
                            <ProofControl
                              method={p.payment_method}
                              path={p.receipt_url}
                              canEdit={canEditCategory}
                              onAttach={() => setProofPrompt({ txId: p.id, method: p.payment_method ?? '', switchMethod: false })}
                            />
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
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Closing Admin{selectedBranchName ? ` — ${selectedBranchName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">Rekap inputan sebelum log out — cek kesesuaian data hari ini</p>
        </div>
        {selectedBranchId && !loading && (
          <div className="flex items-center gap-2 flex-wrap">
            {singleDay && submission && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${SUBMISSION_BADGE[submission.status].cls}`}>
                {SUBMISSION_BADGE[submission.status].label}
              </span>
            )}
            {!singleDay && (role === 'admin' || role === 'finance') && (
              <span className="text-xs text-muted-foreground">Pilih satu tanggal untuk mengajukan / menyetujui closing</span>
            )}
            {canSubmit && submission?.status !== 'submitted' && (
              <button
                type="button"
                onClick={() => setConfirmSubmit(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send size={14} /> {submission?.status === 'rejected' ? 'Ajukan Ulang' : 'Ajukan Closing'}
              </button>
            )}
            {canReview && (
              <>
                <button
                  type="button"
                  onClick={() => setRejecting(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-border text-muted-foreground hover:bg-muted"
                >
                  <XCircle size={14} /> Tolak
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmApprove(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <CheckCircle2 size={14} /> Setujui
                </button>
              </>
            )}
          </div>
        )}
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
          {approved && (
            <div className="glass-card px-4 py-3 flex items-center gap-2 text-xs text-[#34C759]">
              <CheckCircle2 size={14} />
              Closing tanggal ini sudah disetujui Finance{submission?.reviewed_by_name ? ` (${submission.reviewed_by_name})` : ''} — data final, tidak perlu koreksi lagi.
            </div>
          )}
          {singleDay && submission?.status === 'rejected' && (
            <div className="glass-card px-4 py-3 flex items-start gap-2 text-xs text-destructive">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span>Ditolak Finance{submission.reviewed_by_name ? ` (${submission.reviewed_by_name})` : ''}: {submission.review_note ?? '—'} — perbaiki data lalu ajukan ulang.</span>
            </div>
          )}

          {renderUnitSection('Rekap Kunjungan Fisioterapi Klinik', <HeartPulse size={16} className="text-primary" />, visits?.fisioterapi, false)}
          {renderUnitSection('Rekap Kunjungan Sport Massage Klinik', <Dumbbell size={16} className="text-primary" />, visits?.sportMassage, true)}

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
                <button
                  type="button"
                  onClick={() => setShowTxDetail((v) => !v)}
                  aria-expanded={showTxDetail}
                  className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary"
                >
                  {showTxDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Detail Transaksi
                  <span className="text-muted-foreground font-normal">({financial?.transactions.length ?? 0})</span>
                </button>
                {canEditCategory && (
                  <button
                    type="button"
                    onClick={() => { setShowTxDetail(true); setShowAddExpense((v) => !v) }}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus size={13} /> Tambah Pengeluaran
                  </button>
                )}
              </div>

              {showTxDetail && (<>
              {showAddExpense && (
                <div className="mb-3 p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      value={newExpense.category}
                      onChange={(e) => setNewExpense((s) => ({ ...s, category: e.target.value }))}
                      className="px-2 py-1.5 rounded-lg border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
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
                  <PaymentProofField
                    method={newExpense.payment_method}
                    value={newExpense.receipt_url}
                    onChange={(path) => setNewExpense((s) => ({ ...s, receipt_url: path }))}
                    onUploadingChange={setExpenseProofUploading}
                    compact
                  />
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
                      disabled={addingExpense || expenseProofUploading}
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
                              {(t.type === 'income' ? incomeOptions(t.category) : expenseCategories).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-foreground">{t.category}</span>
                          )}
                          {canEditCategory && !isGatewayPayment(t.payment_method) ? (
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
                          <ProofControl
                            method={t.payment_method}
                            path={t.receipt_url}
                            canEdit={canEditCategory}
                            onAttach={() => setProofPrompt({ txId: t.id, method: t.payment_method ?? '', switchMethod: false })}
                          />
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
              </>)}
            </div>
          </div>
        </div>
      )}

      {confirmSubmit && (
        <ConfirmDialog
          title="Ajukan Closing"
          description={`Ajukan closing ${dateLabel} ke Finance? Pastikan semua kunjungan, pembayaran dan pengeluaran hari ini sudah benar. Setelah disetujui Finance, data hari ini dianggap final.`}
          confirmLabel="Ajukan"
          loading={workflowBusy}
          onConfirm={handleSubmitClosing}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}

      {confirmApprove && (
        <ConfirmDialog
          title="Setujui Closing"
          description={`Setujui closing ${dateLabel}? Artinya data harian yang diajukan sudah benar dan tidak perlu koreksi lagi.`}
          confirmLabel="Setujui"
          loading={workflowBusy}
          onConfirm={() => handleReview(true)}
          onCancel={() => setConfirmApprove(false)}
        />
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRejecting(false)}>
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-foreground">Tolak Closing</p>
            <p className="text-xs text-muted-foreground">Tulis data apa yang perlu diperbaiki admin untuk {dateLabel}.</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              autoFocus
              placeholder="mis. Pembayaran pasien X belum dicatat"
              className={`w-full resize-none ${inputCls}`}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(false)}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted">
                Batal
              </button>
              <button type="button" disabled={workflowBusy || !rejectNote.trim()} onClick={() => handleReview(false)}
                className="flex-1 py-2 rounded-xl bg-destructive text-white text-sm font-medium disabled:opacity-50">
                {workflowBusy ? 'Menyimpan...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {proofPrompt && (
        <PaymentProofDialog
          method={proofPrompt.method}
          initialPath={findTxProof(proofPrompt.txId)}
          subtitle={proofPrompt.switchMethod ? 'Ganti metode bayar' : undefined}
          onCancel={() => setProofPrompt(null)}
          onSubmit={saveProofPrompt}
        />
      )}
    </div>
  )
}

/** Proof link when one exists; for transfer rows still missing one, an "add" button. */
function ProofControl({ method, path, canEdit, onAttach }: {
  method: string | null
  path: string | null
  canEdit: boolean
  onAttach: () => void
}) {
  if (path) return <PaymentProofLink path={path} />
  if (!canEdit || !requiresPaymentProof(method)) return null
  return (
    <button
      type="button"
      onClick={onAttach}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-dashed border-[#FFB35C]/50 text-[#FFB35C] hover:bg-[#FFB35C]/10 transition-colors"
    >
      <Plus size={10} /> Bukti
    </button>
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
