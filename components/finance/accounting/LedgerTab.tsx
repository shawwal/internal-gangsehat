'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, CheckCircle, XCircle, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, TransactionType, PaymentMethod, PaymentDetailStatus } from '@/types'
import { createTransactionManual } from '@/app/actions/transactions'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'
import { fetchExpenseCategories, fetchBranchAdmins, type ExpenseCategoryRow, type AdminOption } from '@/app/actions/accounting'
import { todayJakartaISO } from '@/lib/utils'
import { logActivity } from '@/lib/activityLog'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { openPrintableReport } from '@/lib/pdf-export'
import { ExportMenu } from './ExportMenu'
import { formatRp, PAYMENT_METHODS, PAYMENT_STATUSES, inputCls } from './shared'

interface Props {
  type: TransactionType
  branchId: string
  branchName: string
  userId: string
  dateFrom: string
  dateToExclusive: string
  periodLabel: string
}

function getDefaultForm(dateFrom: string) {
  return {
    itemId: '',
    category: '',
    harga: '',
    amount: '',
    discount: '',
    payment_method: 'TUNAI' as PaymentMethod,
    payment_status: 'LUNAS' as PaymentDetailStatus,
    fisio_id: '',
    patient_id: '',
    patient_label: '',
    description: '',
    transaction_date: dateFrom,
  }
}

export function LedgerTab({ type, branchId, branchName, userId, dateFrom, dateToExclusive, periodLabel }: Props) {
  const isIncome = type === 'income'
  const [rows, setRows] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(() => getDefaultForm(todayJakartaISO()))
  const [saving, setSaving] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [layanan, setLayanan] = useState<LayananRow[]>([])
  const [expenseCats, setExpenseCats] = useState<ExpenseCategoryRow[]>([])
  const [admins, setAdmins] = useState<AdminOption[]>([])

  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState<PatientPlain[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('branch_id', branchId)
      .eq('type', type)
      .gte('transaction_date', dateFrom)
      .lt('transaction_date', dateToExclusive)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)
    setRows((data ?? []) as Transaction[])
    setLoading(false)
  }, [branchId, type, dateFrom, dateToExclusive])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!branchId) return
    fetchBranchAdmins(branchId).then(setAdmins)
    if (isIncome) fetchLayananByBranch(branchId).then((rs) => setLayanan(rs.filter((r) => r.is_active)))
    else fetchExpenseCategories(branchId).then((rs) => setExpenseCats(rs.filter((r) => r.is_active)))
  }, [branchId, isIncome])

  useEffect(() => {
    if (patientQuery.trim().length < 2) { setPatientResults([]); return }
    const t = setTimeout(() => {
      searchPatients(patientQuery.trim()).then((rs) => setPatientResults(rs.slice(0, 8)))
    }, 250)
    return () => clearTimeout(t)
  }, [patientQuery])

  function openForm() {
    setForm(getDefaultForm(todayJakartaISO()))
    setPatientQuery('')
    setPatientResults([])
    setShowForm(true)
  }

  function handleItemSelect(itemId: string) {
    const item = layanan.find((l) => l.id === itemId)
    setForm((f) => ({
      ...f,
      itemId,
      // `category` stores the coarse bucket (TA KLINIK, PAKET KLINIK, ...) —
      // the same convention used everywhere else transactions are written
      // (finance/transactions, PaymentDialog, director/finance), so income
      // recorded here still aggregates correctly in Laporan/Arus Kas and in
      // the rest of the app's reports. The specific item name goes into
      // `description` instead, so it's still visible on the transaction.
      category: item?.kategori ?? '',
      description: item && !f.description ? item.nama : f.description,
      harga: item ? String(item.harga) : f.harga,
      amount: item ? String(item.harga) : f.amount,
    }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await createTransactionManual({
      type,
      category: form.category || (isIncome ? 'LAINNYA' : form.category),
      harga: Number(form.harga) || 0,
      amount: Number(form.amount) || 0,
      discount: Number(form.discount) || 0,
      payment_method: form.payment_method || null,
      payment_status: isIncome ? form.payment_status : null,
      penjamin: null,
      description: form.description || null,
      transaction_date: form.transaction_date,
      patient_id: isIncome ? (form.patient_id || null) : null,
      branch_id: branchId,
      fisio_id: form.fisio_id || null,
    })
    setSaving(false)
    if (error) { alert(error); return }

    setShowForm(false)
    load()
  }

  async function confirm(id: string) {
    const oldRow = rows.find((r) => r.id === id)
    const supabase = createClient()
    const { error } = await supabase.from('transactions').update({ status: 'confirmed', confirmed_by: userId }).eq('id', id)
    if (!error && oldRow) {
      await logActivity({
        supabase, userId, action: 'update', resourceType: 'transaction', resourceId: id,
        resourceLabel: `${oldRow.category} — Rp${oldRow.amount}`, branchId: oldRow.branch_id,
        oldValues: { status: oldRow.status }, newValues: { status: 'confirmed', confirmed_by: userId },
      })
    }
    load()
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectId) return
    const oldRow = rows.find((r) => r.id === rejectId)
    const supabase = createClient()
    const { error } = await supabase.from('transactions').update({ status: 'rejected', rejection_reason: rejectReason }).eq('id', rejectId)
    if (!error && oldRow) {
      await logActivity({
        supabase, userId, action: 'update', resourceType: 'transaction', resourceId: rejectId,
        resourceLabel: `${oldRow.category} — Rp${oldRow.amount}`, branchId: oldRow.branch_id,
        oldValues: { status: oldRow.status }, newValues: { status: 'rejected', rejection_reason: rejectReason },
      })
    }
    setRejectId(null); setRejectReason('')
    load()
  }

  const COLS: ExportColumn<Transaction>[] = [
    { header: 'Tanggal', value: (r) => r.transaction_date },
    { header: 'Kategori', value: (r) => r.category },
    { header: 'Harga', value: (r) => r.harga ?? 0 },
    { header: 'Diskon', value: (r) => r.discount ?? 0 },
    { header: 'Total Bayar', value: (r) => r.amount },
    { header: 'Metode Bayar', value: (r) => r.payment_method ?? '' },
    { header: 'Status', value: (r) => r.status },
    { header: 'Keterangan', value: (r) => r.description ?? '' },
  ]

  function handleExportExcel() {
    const today = new Date().toISOString().slice(0, 10)
    exportToExcel(rows, COLS, `${isIncome ? 'pemasukan' : 'pengeluaran'}_${today}`)
  }

  function handleExportPdf() {
    openPrintableReport({
      title: isIncome ? 'Laporan Pemasukan' : 'Laporan Pengeluaran',
      subtitle: periodLabel,
      meta: [
        { label: 'Cabang', value: branchName },
        { label: 'Periode', value: periodLabel },
        { label: 'Total Transaksi', value: String(rows.length) },
      ],
      columns: [
        { header: 'Tanggal', value: (r: Transaction) => r.transaction_date },
        { header: 'Kategori', value: (r: Transaction) => r.category },
        { header: 'Total', align: 'right', value: (r: Transaction) => formatRp(r.amount) },
        { header: 'Status', align: 'center', value: (r: Transaction) => r.status },
      ],
      rows,
      totalsRow: ['', 'Total', formatRp(rows.reduce((s, r) => s + Number(r.amount), 0)), ''],
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{periodLabel} · {rows.length} transaksi</p>
        <div className="flex items-center gap-2">
          <ExportMenu onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} disabled={rows.length === 0} />
          <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{isIncome ? 'Layanan' : 'Kategori'}</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Bayar Via</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{r.transaction_date}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{isIncome && r.description ? r.description : r.category}</p>
                    {isIncome && r.description && <p className="text-xs text-muted-foreground">{r.category}</p>}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${isIncome ? 'text-chart-4' : 'text-destructive'}`}>
                    {isIncome ? '+' : '-'}{formatRp(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.payment_method ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === 'confirmed' ? 'bg-chart-4/15 text-chart-4' : r.status === 'pending' ? 'bg-secondary/20 text-secondary-foreground' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {r.status === 'confirmed' ? 'Dikonfirmasi' : r.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => confirm(r.id)} className="p-1.5 rounded-lg hover:bg-chart-4/10 text-chart-4 transition-colors" title="Konfirmasi"><CheckCircle size={14} /></button>
                        <button onClick={() => { setRejectId(r.id); setRejectReason('') }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Tolak"><XCircle size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="text-sm text-muted-foreground text-center py-8">Belum ada transaksi pada periode ini.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md overflow-y-auto max-h-[90vh]">
            <h2 className="text-base font-semibold text-foreground mb-4">Tambah {isIncome ? 'Pemasukan' : 'Pengeluaran'}</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Tanggal</label>
                <input type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} className={inputCls} />
              </div>

              {isIncome ? (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Jenis Pemeriksaan / Layanan</label>
                  <select required value={form.itemId} onChange={(e) => handleItemSelect(e.target.value)} className={inputCls}>
                    <option value="">Pilih layanan...</option>
                    {layanan.map((l) => <option key={l.id} value={l.id}>{l.nama} — {formatRp(l.harga)}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Kategori</label>
                  <select required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
                    <option value="">Pilih kategori...</option>
                    {expenseCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {isIncome && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Harga (Rp)</label>
                      <input type="number" min="0" value={form.harga} onChange={(e) => setForm((f) => ({ ...f, harga: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Diskon (Rp)</label>
                      <input type="number" min="0" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Nama Pasien (opsional)</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={form.patient_label || patientQuery}
                        onChange={(e) => { setPatientQuery(e.target.value); setForm((f) => ({ ...f, patient_id: '', patient_label: '' })) }}
                        placeholder="Cari nama pasien..."
                        className={`${inputCls} pl-8`}
                      />
                      {patientResults.length > 0 && !form.patient_id && (
                        <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                          {patientResults.map((p) => (
                            <button
                              key={p.id} type="button"
                              onClick={() => { setForm((f) => ({ ...f, patient_id: p.id, patient_label: p.name })); setPatientResults([]) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                            >
                              {p.name} {p.no_rm ? <span className="text-xs text-muted-foreground">· {p.no_rm}</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Jumlah Bayar (Rp)</label>
                  <input required type="number" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Metode Bayar</label>
                  <select value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value as PaymentMethod }))} className={inputCls}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {isIncome && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Status Bayar</label>
                  <select value={form.payment_status} onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value as PaymentDetailStatus }))} className={inputCls}>
                    {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Admin / Fisioterapis</label>
                <select value={form.fisio_id} onChange={(e) => setForm((f) => ({ ...f, fisio_id: e.target.value }))} className={inputCls}>
                  <option value="">— Tidak ditentukan —</option>
                  {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Keterangan</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">Alasan Penolakan</h2>
            <form onSubmit={reject} className="space-y-3">
              <textarea required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setRejectId(null)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" className="flex-1 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors">Tolak</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
