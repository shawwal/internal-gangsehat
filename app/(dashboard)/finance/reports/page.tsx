'use client'

import { useEffect, useState } from 'react'
import { Plus, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { BranchFinancialReport, ReportStatus } from '@/types'

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

const STATUS_BADGE: Record<ReportStatus, string> = {
  draft:     'bg-muted text-muted-foreground',
  submitted: 'bg-secondary/20 text-secondary-foreground',
  approved:  'bg-chart-4/15 text-chart-4',
  rejected:  'bg-destructive/10 text-destructive',
}

const now = new Date()

export default function FinanceReportsPage() {
  const [reports, setReports]   = useState<BranchFinancialReport[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ year: now.getFullYear(), month: now.getMonth() + 1, notes: '' })
  const [saving, setSaving]     = useState(false)

  const [userId, setUserId]     = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)

  async function loadProfile(): Promise<string | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id')
      .eq('id', user.id)
      .single()
    setUserId(user.id)
    setBranchId(profile?.branch_id ?? null)
    return profile?.branch_id ?? null
  }

  async function load(bid: string | null = null) {
    let q = createClient()
      .from('branch_financial_reports')
      .select('*')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
    if (bid) q = q.eq('branch_id', bid)
    const { data } = await q
    setReports((data ?? []) as BranchFinancialReport[])
    setLoading(false)
  }

  useEffect(() => {
    loadProfile().then((bid) => load(bid))
  }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) {
      alert('Akun Anda belum terhubung ke cabang. Hubungi direktur.')
      return
    }
    setSaving(true)
    const supabase = createClient()

    // Date range for the selected period
    const periodStart = `${form.year}-${String(form.month).padStart(2, '0')}-01`
    const lastDay     = new Date(form.year, form.month, 0).getDate()
    const periodEnd   = `${form.year}-${String(form.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [{ data: income }, { data: expense }, { count: visitCount }] = await Promise.all([
      supabase.from('transactions')
        .select('amount')
        .eq('type', 'income').eq('status', 'confirmed').eq('branch_id', branchId)
        .gte('transaction_date', periodStart).lte('transaction_date', periodEnd),
      supabase.from('transactions')
        .select('amount')
        .eq('type', 'expense').eq('status', 'confirmed').eq('branch_id', branchId)
        .gte('transaction_date', periodStart).lte('transaction_date', periodEnd),
      supabase.from('patient_visits')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .gte('visit_date', periodStart).lte('visit_date', periodEnd),
    ])

    const totalIncome  = (income ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const totalExpense = (expense ?? []).reduce((s, r) => s + Number(r.amount), 0)

    // Distinct patient count via visit records for this branch/period
    const { data: patientVisits } = await supabase
      .from('patient_visits')
      .select('patient_id')
      .eq('branch_id', branchId)
      .gte('visit_date', periodStart).lte('visit_date', periodEnd)

    const patientCount = new Set((patientVisits ?? []).map((v) => v.patient_id)).size

    const { error } = await supabase.from('branch_financial_reports').upsert({
      branch_id:     branchId,
      period_year:   form.year,
      period_month:  form.month,
      total_income:  totalIncome,
      total_expense: totalExpense,
      patient_count: patientCount,
      visit_count:   visitCount ?? 0,
      notes:         form.notes || null,
      status:        'draft',
    }, { onConflict: 'branch_id,period_year,period_month' })

    if (error) alert('Gagal menyimpan laporan: ' + error.message)

    setSaving(false)
    setShowForm(false)
    load(branchId)
  }

  async function submit(id: string) {
    await createClient().from('branch_financial_reports').update({
      status:       'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by: userId,
    }).eq('id', id)
    load(branchId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Laporan Bulanan</h1>
          <p className="text-sm text-muted-foreground">Generate dan kirim laporan ke direktur</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={16} /> Generate Laporan
        </button>
      </div>

      {!branchId && !loading && (
        <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 text-sm text-secondary-foreground">
          Akun Anda belum terhubung ke cabang. Hubungi direktur untuk pengaturan cabang.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Periode</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pemasukan</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pengeluaran</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Net Profit</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pasien</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{MONTH_NAMES[r.period_month - 1]} {r.period_year}</td>
                  <td className="px-4 py-3 text-right text-chart-4">{formatRp(r.total_income)}</td>
                  <td className="px-4 py-3 text-right text-destructive">{formatRp(r.total_expense)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.net_profit >= 0 ? 'text-chart-4' : 'text-destructive'}`}>
                    {formatRp(r.net_profit)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                    {r.patient_count} pasien · {r.visit_count} kunjungan
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'draft' && (
                      <button onClick={() => submit(r.id)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors ml-auto">
                        <Send size={12} /> Kirim
                      </button>
                    )}
                    {r.status === 'rejected' && r.notes && (
                      <span className="text-xs text-destructive">{r.notes}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reports.length && <p className="text-sm text-muted-foreground text-center py-8">Belum ada laporan.</p>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">Generate Laporan Bulanan</h2>
            <form onSubmit={handleGenerate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Bulan</label>
                  <select value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tahun</label>
                  <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Catatan (opsional)</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" disabled={saving || !branchId} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? 'Memproses...' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
