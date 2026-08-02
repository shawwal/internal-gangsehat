'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Wallet } from 'lucide-react'
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
import { updateTransaction } from '@/app/actions/transactions'

type Role = 'director' | 'manager' | 'finance' | 'hr' | 'marketing' | 'staff' | 'therapist' | 'admin' | null

const INCOME_CATEGORIES = ['TA KLINIK', 'PAKET KLINIK', 'SESI KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA']
const EXPENSE_CATEGORIES = ['BEBAN PELAYANAN', 'GAJI', 'SEWA', 'LISTRIK', 'MARKETING', 'TUKAR TUNAI', 'LAINNYA']

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

  const [branchList, setBranchList] = useState<BranchOption[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [selectedBranchName, setSelectedBranchName] = useState<string>('')
  const [date, setDate] = useState(TODAY_ISO)

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
      fetchClosingFinancialRecap(selectedBranchId, date),
      fetchClosingVisitRecap(selectedBranchId, date),
    ])
    setFinancial(fin)
    setVisits(vis)
    setLoading(false)
  }, [selectedBranchId, date])

  useEffect(() => { load() }, [load])

  async function handleCategoryChange(txId: string, type: 'income' | 'expense', category: string) {
    setSavingTxId(txId)
    setFinancial((prev) => prev
      ? { ...prev, transactions: prev.transactions.map((t) => (t.id === txId ? { ...t, category } : t)) }
      : prev)
    const { error } = await updateTransaction(txId, { category })
    setSavingTxId(null)
    if (error) load()
  }

  function handleBranchChange(id: string) {
    setSelectedBranchId(id)
    setSelectedBranchName(branchList.find((b) => b.id === id)?.name ?? '')
  }

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Closing Admin{selectedBranchName ? ` — ${selectedBranchName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">Rekap inputan sebelum log out — cek kesesuaian data hari ini</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
        />
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
        <div className="animate-pulse bg-muted rounded-3xl h-72" />
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

            {financial && financial.transactions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Detail Transaksi</p>
                <div className="space-y-1.5">
                  {financial.transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-muted/30 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {canEditCategory ? (
                            <select
                              value={t.category}
                              disabled={savingTxId === t.id}
                              onChange={(e) => handleCategoryChange(t.id, t.type, e.target.value)}
                              className="font-medium text-foreground bg-transparent border border-border rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            >
                              {(t.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-foreground">{t.category}</span>
                          )}
                          {t.payment_method && <span className="text-muted-foreground">· {t.payment_method}</span>}
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${TX_STATUS_BADGE[t.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {TX_STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </div>
                        {t.description && <p className="text-muted-foreground/80 truncate mt-0.5">{t.description}</p>}
                      </div>
                      <span className={`shrink-0 font-semibold ${t.type === 'income' ? 'text-[#34C759]' : 'text-destructive'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          </div>
        </div>
      )}
    </div>
  )
}
