'use client'

import { useEffect, useState } from 'react'
import { BookOpen, TrendingUp, TrendingDown, BarChart3, Wallet, Settings2, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGriyaBranch } from '@/hooks/useGriyaBranch'
import { LedgerTab } from '@/components/finance/accounting/LedgerTab'
import { LaporanTab } from '@/components/finance/accounting/LaporanTab'
import { ArusKasTab } from '@/components/finance/accounting/ArusKasTab'
import { PengaturanTab } from '@/components/finance/accounting/PengaturanTab'
import { MONTH_NAMES, monthRange, yearRange } from '@/components/finance/accounting/shared'
import AkuntansiLoading from './loading'

type TabKey = 'pemasukan' | 'pengeluaran' | 'laporan' | 'aruskas' | 'pengaturan'
const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: 'pemasukan', label: 'Pemasukan', icon: TrendingUp },
  { key: 'pengeluaran', label: 'Pengeluaran', icon: TrendingDown },
  { key: 'laporan', label: 'Laporan', icon: BarChart3 },
  { key: 'aruskas', label: 'Arus Kas', icon: Wallet },
  { key: 'pengaturan', label: 'Pengaturan', icon: Settings2 },
]

export default function AkuntansiPage() {
  const { loading, branchId: defaultBranchId, role, canEdit } = useGriyaBranch()
  const isDirector = role === 'director'
  const [userId, setUserId] = useState<string>('')
  const [branches, setBranches] = useState<{ id: string; name: string }[] | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(readSavedBranch)
  // Director (no own branch) picks any branch — last pick remembered in this
  // browser, else the first branch. Everyone else is fixed to their own branch;
  // useGriyaBranch's Griya Anak fallback only applies to branch-less directors.
  const branchId = isDirector && branches
    ? (branches.find((b) => b.id === selectedBranchId)?.id ?? branches[0]?.id ?? defaultBranchId)
    : defaultBranchId

  function pickBranch(id: string) {
    setSelectedBranchId(id)
    try { localStorage.setItem(BRANCH_KEY, id) } catch { /* just not remembered */ }
  }
  const branchName = (branches ?? []).find((b) => b.id === branchId)?.name ?? ''
  const [tab, setTab] = useState<TabKey>('pemasukan')

  const [periodMode, setPeriodMode] = useState<PeriodMode>(readPeriodMode)
  const [range, setRange] = useState(() => periodContaining(periodMode, new Date()))

  function changePeriodMode(mode: PeriodMode) {
    setPeriodMode(mode)
    setRange(periodContaining(mode, new Date(`${range.from}T00:00:00`)))
    try { localStorage.setItem(PERIOD_MODE_KEY, mode) } catch { /* storage unavailable — just not remembered */ }
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      // Director sees every active branch; others only their own (RLS-scoped).
      const { data } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name')
      setBranches(data ?? [])
    })()
  }, [])

  // Wait for the branch list so a director's remembered branch is applied
  // before the first ledger fetch (no load of the wrong branch first).
  if (loading || !branches) {
    return <AkuntansiLoading />
  }
  if (!branchId) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Cabang tidak ditemukan.</div>
  }
  if (!canEdit) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Halaman ini hanya untuk admin, manajer, dan direktur.</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Akuntansi</h1>
            <p className="text-sm text-muted-foreground">{branchName} · pembukuan harian &amp; bulanan</p>
          </div>
        </div>
        {isDirector && branches.length > 0 && (
          <select value={branchId} onChange={(e) => pickBranch(e.target.value)}
            className="glass-card px-3 py-2 rounded-xl text-sm bg-transparent text-foreground cursor-pointer">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="glass-card p-1.5 inline-flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}>
              <Icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {(tab === 'pemasukan' || tab === 'pengeluaran' || tab === 'laporan') && (
        <PeriodPicker mode={periodMode} onModeChange={changePeriodMode} range={range} onChange={setRange} />
      )}

      <div key={branchId} className="space-y-5">
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
    </div>
  )
}

// Director's last-opened branch on this page (per browser).
const BRANCH_KEY = 'akuntansi.branchId'

function readSavedBranch(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(BRANCH_KEY) : null
  } catch {
    return null
  }
}

type PeriodMode = 'month' | 'semester' | 'year'
type Range = { from: string; toExclusive: string; label: string }
const PERIOD_MODES: { key: PeriodMode; label: string }[] = [
  { key: 'month', label: 'Bulan' },
  { key: 'semester', label: 'Semester' },
  { key: 'year', label: 'Tahun' },
]
// Per-browser preference: which period granularity the page opens on.
const PERIOD_MODE_KEY = 'akuntansi.periodMode'

function readPeriodMode(): PeriodMode {
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem(PERIOD_MODE_KEY) : null
    return v === 'semester' || v === 'year' ? v : 'month'
  } catch {
    return 'month'
  }
}

/** The month / semester / year that contains `d`. */
function periodContaining(mode: PeriodMode, d: Date): Range {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  if (mode === 'year') return { ...yearRange(y), label: `Tahun ${y}` }
  if (mode === 'semester') {
    const s1 = m <= 6
    return {
      from: `${y}-${s1 ? '01' : '07'}-01`,
      toExclusive: s1 ? `${y}-07-01` : `${y + 1}-01-01`,
      label: `Semester ${s1 ? '1 (Jan–Jun)' : '2 (Jul–Des)'} ${y}`,
    }
  }
  return { ...monthRange(y, m), label: `${MONTH_NAMES[m - 1]} ${y}` }
}

function PeriodPicker({
  mode, onModeChange, range, onChange,
}: {
  mode: PeriodMode
  onModeChange: (mode: PeriodMode) => void
  range: Range
  onChange: (r: Range) => void
}) {
  function go(delta: number) {
    const d = new Date(`${range.from}T00:00:00`)
    const step = mode === 'year' ? 12 : mode === 'semester' ? 6 : 1
    onChange(periodContaining(mode, new Date(d.getFullYear(), d.getMonth() + delta * step, 1)))
  }

  return (
    <div className="glass-card p-2 inline-flex flex-wrap items-center gap-2">
      <div className="inline-flex gap-1">
        {PERIOD_MODES.map((p) => (
          <button key={p.key} onClick={() => onModeChange(p.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mode === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      <button onClick={() => go(-1)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"><ChevronLeft size={15} /></button>
      <span className="text-sm font-medium px-2 min-w-[120px] text-center">{range.label}</span>
      <button onClick={() => go(1)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"><ChevronRight size={15} /></button>
    </div>
  )
}
