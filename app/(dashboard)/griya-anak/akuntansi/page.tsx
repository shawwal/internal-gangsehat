'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, TrendingUp, TrendingDown, BarChart3, Wallet, Settings2, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGriyaBranch } from '@/hooks/useGriyaBranch'
import { LedgerTab } from '@/components/finance/accounting/LedgerTab'
import { LaporanTab } from '@/components/finance/accounting/LaporanTab'
import { ArusKasTab } from '@/components/finance/accounting/ArusKasTab'
import { PengaturanTab } from '@/components/finance/accounting/PengaturanTab'
import { MONTH_NAMES, monthRange } from '@/components/finance/accounting/shared'

type TabKey = 'pemasukan' | 'pengeluaran' | 'laporan' | 'aruskas' | 'pengaturan'
const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: 'pemasukan', label: 'Pemasukan', icon: TrendingUp },
  { key: 'pengeluaran', label: 'Pengeluaran', icon: TrendingDown },
  { key: 'laporan', label: 'Laporan', icon: BarChart3 },
  { key: 'aruskas', label: 'Arus Kas', icon: Wallet },
  { key: 'pengaturan', label: 'Pengaturan', icon: Settings2 },
]

export default function GriyaAkuntansiPage() {
  const { loading, branchId, enabled, canEdit } = useGriyaBranch()
  const [userId, setUserId] = useState<string>('')
  const [branchName, setBranchName] = useState('Griya Anak')
  const [tab, setTab] = useState<TabKey>('pemasukan')

  const now = useMemo(() => new Date(), [])
  const [range, setRange] = useState(() => {
    const { from, toExclusive } = monthRange(now.getFullYear(), now.getMonth() + 1)
    return { from, toExclusive, label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` }
  })

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      if (branchId) {
        const { data } = await supabase.from('branches').select('name').eq('id', branchId).maybeSingle()
        if (data?.name) setBranchName(data.name)
      }
    })()
  }, [branchId])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-10 w-full max-w-lg rounded-xl bg-muted" />
        <div className="h-64 w-full rounded-2xl bg-muted" />
      </div>
    )
  }
  if (!branchId || !enabled) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>
  }
  if (!canEdit) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Halaman ini hanya untuk admin, manajer, dan direktur.</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen size={20} className="text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Akuntansi Griya Anak</h1>
          <p className="text-sm text-muted-foreground">{branchName} · pembukuan harian &amp; bulanan</p>
        </div>
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

  function go(delta: number) {
    let m = month + delta, y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    const { from, toExclusive } = monthRange(y, m)
    onChange({ from, toExclusive, label: `${MONTH_NAMES[m - 1]} ${y}` })
  }

  return (
    <div className="glass-card p-2 inline-flex items-center gap-2">
      <button onClick={() => go(-1)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"><ChevronLeft size={15} /></button>
      <span className="text-sm font-medium px-2 min-w-[120px] text-center">{range.label}</span>
      <button onClick={() => go(1)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"><ChevronRight size={15} /></button>
    </div>
  )
}
