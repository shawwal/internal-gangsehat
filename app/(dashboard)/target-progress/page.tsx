'use client'

import './target-progress-styles.css'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Table2, TrendingUp, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { datesBetween, KUNJUNGAN_SERVICE_FILTER, KUNJUNGAN_VISIT_STATUSES } from '@/lib/metrics/achievement'
import { todayJakartaISO } from '@/lib/utils'
import { fetchTargetProgressTransactions } from '@/app/actions/targetProgress'
import { getPayrollWindow } from '@/app/actions/pfotm'
import { MonthPicker } from '@/components/targetProgress/MonthPicker'
import { BranchPicker } from '@/components/targetProgress/BranchPicker'
import { ClassicTable } from '@/components/targetProgress/ClassicTable'
import { ModernView } from '@/components/targetProgress/ModernView'
import {
  CATEGORY_DEFS,
  type CategoryKey,
  type CategorySummary,
  type BranchOption,
  type BranchTargetForProgress,
  type VisitForProgress,
} from '@/components/targetProgress/types'
import { buildDailyCounts, buildTransactionDailyCounts, mergeDailyCounts, sum, getMonthRange, MONTHS, CURRENT_MONTH, CURRENT_YEAR } from '@/components/targetProgress/utils'
import { SkeletonRegion, StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

type Tab = 'klasik' | 'visual'
/** Calendar month, or the payroll / PFOTM window (27 → 26) so Capaian matches those pages one-to-one. */
type WindowMode = 'month' | 'payroll'
type Role = 'director' | 'manager' | 'finance' | 'hr' | 'marketing' | 'staff' | 'therapist' | 'admin' | null

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'klasik', label: 'Klasik', icon: <Table2 size={15} /> },
  { id: 'visual', label: 'Progress Visual', icon: <TrendingUp size={15} /> },
]

// `?branch=&m=&y=&mode=` — kept in sync below so Back from the detail page
// (or a reload) lands on the same branch / month / window.
function parseInitial(sp: URLSearchParams) {
  const m = Number(sp.get('m'))
  const y = Number(sp.get('y'))
  const valid = Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(y) && y >= 2000 && y <= 2100
  return {
    branch: sp.get('branch'),
    month: valid ? m : CURRENT_MONTH,
    year: valid ? y : CURRENT_YEAR,
    mode: (sp.get('mode') === 'payroll' ? 'payroll' : 'month') as WindowMode,
  }
}

export default function TargetProgressPage() {
  const searchParams = useSearchParams()
  const [initial] = useState(() => parseInitial(searchParams))
  const [role, setRole] = useState<Role>(null)

  const canPickBranch = role === 'director'

  const [branchList, setBranchList] = useState<BranchOption[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(initial.branch)
  const [selectedBranchName, setSelectedBranchName] = useState<string>('')

  const [month, setMonth] = useState(initial.month)
  const [year, setYear] = useState(initial.year)
  const [tab, setTab] = useState<Tab>('klasik')
  const [windowMode, setWindowMode] = useState<WindowMode>(initial.mode)
  const [dates, setDates] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [hasApprovedTarget, setHasApprovedTarget] = useState(true)
  const [summaries, setSummaries] = useState<CategorySummary[]>([])

  // ── Init: resolve profile, load branch list for director ─────────────────
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
      const r = p.role as Role
      setRole(r)

      if (r === 'director') {
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        const list = (branchData ?? []) as BranchOption[]
        setBranchList(list)
        const fromUrl = list.find(b => b.id === initial.branch)
        if (fromUrl) setSelectedBranchName(fromUrl.name)
        else setSelectedBranchId(null)
      } else if (p.branch_id) {
        setSelectedBranchId(p.branch_id)
        setSelectedBranchName(p.branches?.name ?? '')
      }
    }
    init()
  }, [initial.branch])

  const query = new URLSearchParams({
    ...(selectedBranchId ? { branch: selectedBranchId } : {}),
    m: String(month),
    y: String(year),
    mode: windowMode,
  }).toString()
  useEffect(() => {
    window.history.replaceState(null, '', `?${query}`)
  }, [query])

  // ── Load branch target + visits for selected branch/month ────────────────
  const load = useCallback(async () => {
    if (!selectedBranchId) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    let range = getMonthRange(month, year)
    if (windowMode === 'payroll') {
      const win = await getPayrollWindow(selectedBranchId, year, month)
      if (win.ok) range = win.data
    }

    // Daily counts for any window — same queries for the period and its comparison window.
    const countWindow = async (start: string, end: string) => {
      const [{ data: visits }, transactionRows] = await Promise.all([
        supabase
          .from('patient_visits')
          .select('id, visit_date, kehadiran, status, service_type')
          .eq('branch_id', selectedBranchId)
          .gte('visit_date', start)
          .lte('visit_date', end)
          .in('status', [...KUNJUNGAN_VISIT_STATUSES])
          // Sport massage is tracked separately — not a "kunjungan"
          .or(KUNJUNGAN_SERVICE_FILTER),
        // Server action — therapist/staff can't read `transactions` under RLS
        fetchTargetProgressTransactions(selectedBranchId, start, end),
      ])
      const windowDates = datesBetween(start, end)
      return {
        dates: windowDates,
        daily: mergeDailyCounts(
          buildDailyCounts((visits ?? []) as VisitForProgress[], windowDates),
          buildTransactionDailyCounts(transactionRows, windowDates),
        ),
      }
    }

    // Comparison: the previous month / payroll window over the same number of
    // days elapsed so far (the whole period once it has ended).
    const prevYm = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year }
    let prevRange = getMonthRange(prevYm.m, prevYm.y)
    if (windowMode === 'payroll') {
      const win = await getPayrollWindow(selectedBranchId, prevYm.y, prevYm.m)
      if (win.ok) prevRange = win.data
    }
    const today = todayJakartaISO()
    const elapsed = today < range.start ? 0 : datesBetween(range.start, today < range.end ? today : range.end).length
    const prevDates = datesBetween(prevRange.start, prevRange.end)
    const prevEnd = elapsed > 0 ? prevDates[Math.min(elapsed, prevDates.length) - 1] : null

    const [{ data: targetRow }, current, previous, { data: categorySettings }] = await Promise.all([
      supabase
        .from('branch_targets')
        .select('target_terapi_awal, target_paket_klinik, target_kunjungan, target_visit, target_sesi')
        .eq('branch_id', selectedBranchId)
        .eq('bulan', month)
        .eq('tahun', year)
        .eq('status', 'approved')
        .maybeSingle(),
      countWindow(range.start, range.end),
      prevEnd ? countWindow(prevRange.start, prevEnd) : Promise.resolve(null),
      supabase
        .from('branch_target_category_settings')
        .select('category')
        .eq('branch_id', selectedBranchId),
    ])

    const disabled = new Set((categorySettings ?? []).map(r => r.category as CategoryKey))
    setDates(current.dates)
    const daily = current.daily
    const t = targetRow as BranchTargetForProgress | null
    const targetFields: Record<CategoryKey, number> = {
      terapi_awal: t?.target_terapi_awal ?? 0,
      paket_klinik: t?.target_paket_klinik ?? 0,
      kunjungan: t?.target_kunjungan ?? 0,
      paket_visit: t?.target_visit ?? 0,
      sesi: t?.target_sesi ?? 0,
    }

    setHasApprovedTarget(!!t)
    setSummaries(CATEGORY_DEFS
      .filter(def => !disabled.has(def.key))
      .map(def => {
        const actual = sum(daily[def.key])
        const target = targetFields[def.key]
        // Actual so far over the elapsed days only (later days are 0 anyway).
        const sofar = sum(daily[def.key].slice(0, elapsed))
        return {
          key: def.key, label: def.label, color: def.color, target, actual, selisih: actual - target, daily: daily[def.key],
          perDay: elapsed > 0 ? sofar / elapsed : null,
          previous: previous ? sum(previous.daily[def.key]) : null,
          current: sofar,
        }
      }))
    setLoading(false)
  }, [selectedBranchId, month, year, windowMode])

  useEffect(() => { load() }, [load])

  function handleBranchChange(id: string) {
    setSelectedBranchId(id)
    setSelectedBranchName(branchList.find(b => b.id === id)?.name ?? '')
  }

  const days = dates.length
  const monthLabel = `${MONTHS[month - 1]} ${year}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Progress Target{selectedBranchName ? ` — ${selectedBranchName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">Laporan capaian target cabang bulanan</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/40 rounded-2xl p-1 gap-0.5" role="group" aria-label="Rentang tanggal">
            {([['month', 'Bulan kalender'], ['payroll', 'Periode gaji']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setWindowMode(value)}
                aria-pressed={windowMode === value}
                title={value === 'payroll' ? 'Rentang yang sama dengan PFOTM & Penggajian (default 27–26)' : undefined}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  windowMode === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
        </div>
      </div>

      {/* Branch picker (director only) */}
      {canPickBranch && (
        <div className="glass-card p-4">
          <BranchPicker
            branches={branchList}
            selectedId={selectedBranchId}
            onChange={handleBranchChange}
          />
        </div>
      )}

      {!selectedBranchId ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <p className="text-sm font-medium text-foreground">Pilih cabang untuk melihat progress target</p>
        </div>
      ) : loading ? (
        <SkeletonRegion>
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={8} cols={6} />
        </SkeletonRegion>
      ) : (
        <>
          {!hasApprovedTarget && (
            <div className="flex items-center gap-3 p-3.5 bg-secondary/10 border border-secondary/30 rounded-2xl">
              <Info size={16} className="text-secondary shrink-0" />
              <p className="text-xs text-secondary-foreground">
                Belum ada target cabang yang disetujui untuk {monthLabel}. Data capaian tetap ditampilkan.
              </p>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 flex-wrap">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  tab === t.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div key={tab} className="animate-fade-in">
            {tab === 'klasik' && (
              <ClassicTable
                summaries={summaries}
                dates={dates}
                monthLabel={monthLabel}
                branchId={selectedBranchId}
                backQuery={query}
              />
            )}
            {tab === 'visual' && (
              <ModernView summaries={summaries} days={days} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
