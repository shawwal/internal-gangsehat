'use client'

import { useEffect, useState } from 'react'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, TransactionType, TransactionStatus } from '@/types'

const TYPE_LABELS: Record<TransactionType, string>     = { income: 'Pemasukan', expense: 'Pengeluaran' }
const STATUS_BADGE: Record<TransactionStatus, string>  = {
  pending:   'bg-secondary/20 text-secondary-foreground',
  confirmed: 'bg-chart-4/15 text-chart-4',
  rejected:  'bg-destructive/10 text-destructive',
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

const CATEGORIES = ['Terapi','Obat','Operasional','Gaji','Sewa','Utilitas','Marketing','Lainnya']

export default function TransactionsPage() {
  const [rows, setRows]         = useState<Transaction[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ type: 'income' as TransactionType, category: CATEGORIES[0], amount: '', description: '', transaction_date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving]     = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  async function load() {
    const { data } = await createClient()
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .limit(100)
    setRows((data ?? []) as Transaction[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await createClient().from('transactions').insert({
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      description: form.description || null,
      transaction_date: form.transaction_date,
    })
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function confirm(id: string) {
    await createClient().from('transactions').update({ status: 'confirmed' }).eq('id', id)
    load()
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectId) return
    await createClient().from('transactions').update({ status: 'rejected', rejection_reason: rejectReason }).eq('id', rejectId)
    setRejectId(null)
    setRejectReason('')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Transaksi</h1>
          <p className="text-sm text-muted-foreground">Catat dan kelola transaksi keuangan cabang</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Tambah
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kategori</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipe</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Jumlah</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{r.transaction_date}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.type === 'income' ? 'bg-chart-4/15 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>
                      {TYPE_LABELS[r.type]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${r.type === 'income' ? 'text-chart-4' : 'text-destructive'}`}>
                    {r.type === 'income' ? '+' : '-'}{formatRp(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => confirm(r.id)} className="p-1.5 rounded-lg hover:bg-chart-4/10 text-chart-4 transition-colors" title="Konfirmasi">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => { setRejectId(r.id); setRejectReason('') }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Tolak">
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="text-sm text-muted-foreground text-center py-8">Belum ada transaksi.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">Tambah Transaksi</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tipe</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TransactionType }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tanggal</label>
                  <input type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Kategori</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Jumlah (Rp)</label>
                <input required type="number" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Deskripsi</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
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
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">Alasan Penolakan</h2>
            <form onSubmit={reject} className="space-y-3">
              <textarea required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
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
