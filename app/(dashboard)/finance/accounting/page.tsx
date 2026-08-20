'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, TrendingUp, TrendingDown, BarChart3, Wallet, Settings2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LedgerTab } from '@/components/finance/accounting/LedgerTab'
import { LaporanTab } from '@/components/finance/accounting/LaporanTab'
import { ArusKasTab } from '@/components/finance/accounting/ArusKasTab'
import { PengaturanTab } from '@/components/finance/accounting/PengaturanTab'
import { MONTH_NAMES, monthRange } from '@/components/finance/accounting/shared'

type TabKey = 'pemasukan' | 'pengeluaran' | 'laporan' | 'aruskas' | 'pengaturan'

const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: 'pemasukan',   label: 'Pemasukan',   icon: TrendingUp },
  { key: 'pengeluaran', label: 'Pengeluaran', icon: TrendingDown },
  { key: 'laporan',     label: 'Laporan',     icon: BarChart3 },
  { key: 'aruskas',     label: 'Arus Kas',    icon: Wallet },
  { key: 'pengaturan',  label: 'Pengaturan',  icon: Settings2 },
]

interface BranchOption { id: string; name: string }

export default function AccountingPage() {
  const [tab, setTab] = useState<TabKey>('pemasukan')
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [branchName, setBranchName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([])

  const now = useMemo(() => new Date(), [])
  const [range, setRange] = useState(() => {
    const { from, toExclusive } = monthRange(now.getFullYear(), now.getMonth() + 1)
    return { from, toExclusive, label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` }
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('role, branch_id, branches!branch_id(name)')
        .eq('id', user.id)
        .single()
      setUserId(user.id)
      setRole(profile?.role ?? null)
      setBranchId(profile?.branch_id ?? null)
      setBranchName(((profile?.branches as unknown as { name: string } | null))?.name ?? '')

      // Director accounts are branch_id = NULL by design (cross-branch access) —
      // let them pick a branch to preview instead of hitting a dead end here.
      if (profile?.role === 'director') {
        const { data: branches } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name')
        setBranchOptions((branches ?? []) as BranchOption[])
      }
      setLoading(false)
    }
    load()
  }, [])

  function selectBranch(id: string) {
    const b = branchOptions.find((x) => x.id === id)
    setBranchId(id)
    setBranchName(b?.name ?? '')
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat...</p>

  if (!userId) {
    return (
      <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 text-sm text-foreground">
        Sesi Anda tidak valid. Silakan login kembali.
      </div>
    )
  }

  if (!branchId) {
    if (role === 'director') {
      return (
        <div className="glass-card p-6 max-w-sm">
          <h2 className="text-base font-semibold text-foreground mb-1">Pilih Cabang</h2>
          <p className="text-sm text-muted-foreground mb-4">Akun direktur tidak terikat ke satu cabang — pilih cabang untuk melihat pembukuannya.</p>
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) selectBranch(e.target.value) }}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>Pilih cabang...</option>
            {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 text-sm text-foreground">
        Akun Anda belum terhubung ke cabang. Hubungi direktur untuk pengaturan cabang.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Akuntansi</h1>
            <p className="text-sm text-muted-foreground">{branchName} · Pembukuan harian cabang Anda</p>
          </div>
        </div>
        {role === 'director' && branchOptions.length > 0 && (
          <select
            value={branchId}
            onChange={(e) => selectBranch(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="glass-card p-1.5 inline-flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {(tab === 'pemasukan' || tab === 'pengeluaran') && (
        <MonthPicker range={range} onChange={setRange} />
      )}

      {tab === 'pemasukan' && (
        <LedgerTab type="income" branchId={branchId} branchName={branchName} userId={userId}
          dateFrom={range.from} dateToExclusive={range.toExclusive} periodLabel={range.label} />
      )}
      {tab === 'pengeluaran' && (
        <LedgerTab type="expense" branchId={branchId} branchName={branchName} userId={userId}
          dateFrom={range.from} dateToExclusive={range.toExclusive} periodLabel={range.label} />
      )}
      {tab === 'laporan' && (
        <LaporanTab branchId={branchId} branchName={branchName}
          dateFrom={range.from} dateToExclusive={range.toExclusive} periodLabel={range.label}
          onRangeChange={(from, toExclusive, label) => setRange({ from, toExclusive, label })} />
      )}
      {tab === 'aruskas' && <ArusKasTab branchId={branchId} branchName={branchName} />}
      {tab === 'pengaturan' && <PengaturanTab branchId={branchId} />}
    </div>
  )
}

function MonthPicker({
  range, onChange,
}: {
  range: { from: string; toExclusive: string; label: string }
  onChange: (r: { from: string; toExclusive: string; label: string }) => void
}) {
  const d = new Date(range.from)
  const year = d.getFullYear()
  const month = d.getMonth() + 1

  function setMonth(newYear: number, newMonth: number) {
    const { from, toExclusive } = monthRange(newYear, newMonth)
    onChange({ from, toExclusive, label: `${MONTH_NAMES[newMonth - 1]} ${newYear}` })
  }

  return (
    <div className="flex items-center gap-2">
      <select value={month} onChange={(e) => setMonth(year, Number(e.target.value))}
        className="px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
        {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <input type="number" value={year} onChange={(e) => setMonth(Number(e.target.value) || year, month)}
        className="w-24 px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  )
}
