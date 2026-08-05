'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  fetchMedicalRecords, fetchMedicalRecordStats, fetchRecordFilterOptions,
} from '@/app/actions/medicalRecords'
import type { MedicalRecordRow, RecordFilterOptions } from '@/app/actions/medicalRecords'
import { sendMedicalRecordReminder, sendBulkMedicalRecordReminders } from '@/app/actions/jadwal'
import { MedicalRecordsStats } from '@/components/medicalRecords/MedicalRecordsStats'
import { MedicalRecordsFilters } from '@/components/medicalRecords/MedicalRecordsFilters'
import { MedicalRecordsList } from '@/components/medicalRecords/MedicalRecordsList'
import { Pagination } from '@/components/leave/Pagination'
import { MedicalRecordModal } from '@/components/jadwal/MedicalRecordModal'
import { DEFAULT_RECORD_FILTERS, PAGE_SIZE, type RecordFiltersState } from '@/components/medicalRecords/types'

const EMPTY_OPTIONS: RecordFilterOptions = { scope: 'own', isDirector: false, branches: [], staff: [] }

export default function MedicalRecordsPage() {
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [filters, setFilters] = useState<RecordFiltersState>(() => {
    const search = searchParams.get('q') ?? ''
    const staffId = searchParams.get('staffId')
    const branchId = searchParams.get('branchId')
    const completeness = searchParams.get('completeness')
    const period = searchParams.get('period')
    const sortOrder = searchParams.get('sortOrder')
    const groupBy = searchParams.get('groupBy')
    return {
      ...DEFAULT_RECORD_FILTERS,
      search,
      ...(staffId ? { staffId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(completeness === 'complete' || completeness === 'incomplete' || completeness === 'all'
        ? { completeness }
        : {}),
      ...(period === '7' || period === '30' || period === '90' || period === 'all' ? { period } : {}),
      ...(sortOrder === 'asc' || sortOrder === 'desc' ? { sortOrder } : {}),
      ...(groupBy === 'date' || groupBy === 'patient' ? { groupBy } : {}),
    }
  })
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))
  // Skips the filter-driven page reset on the very first load, so a `page`
  // restored from the URL (e.g. returning from a saved record) isn't
  // immediately clobbered back to 1 by the effect below.
  const isFirstLoad = useRef(true)

  const [rows, setRows]       = useState<MedicalRecordRow[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)

  const [stats, setStats]               = useState({ complete: 0, incomplete: 0 })
  const [statsLoading, setStatsLoading] = useState(true)

  const [options, setOptions]     = useState<RecordFilterOptions>(EMPTY_OPTIONS)
  const [hasAnyRecords, setHasAnyRecords] = useState(true)

  const [quickFormVisitId, setQuickFormVisitId] = useState<string | null>(null)
  const [remindingIds, setRemindingIds] = useState<Set<string>>(new Set())
  const [remindedIds, setRemindedIds]   = useState<Set<string>>(new Set())
  const [remindAllLoading, setRemindAllLoading] = useState(false)

  const isTeamView = options.scope === 'team'

  useEffect(() => {
    fetchRecordFilterOptions().then(setOptions)
  }, [])

  const loadRows = useCallback(async (currentPage: number, currentFilters: RecordFiltersState) => {
    setLoading(true)
    const result = await fetchMedicalRecords({
      page: currentPage, pageSize: PAGE_SIZE,
      search: currentFilters.search,
      completeness: currentFilters.completeness,
      period: currentFilters.period,
      sortOrder: currentFilters.sortOrder,
      groupBy: currentFilters.groupBy,
      staffId: currentFilters.staffId,
      branchId: currentFilters.branchId,
    })
    setRows(result.rows)
    setTotal(result.total)
    setLoading(false)
  }, [])

  const loadStats = useCallback(async (currentFilters: RecordFiltersState) => {
    setStatsLoading(true)
    const result = await fetchMedicalRecordStats({
      search: currentFilters.search,
      period: currentFilters.period,
      staffId: currentFilters.staffId,
      branchId: currentFilters.branchId,
    })
    setStats(result)
    setHasAnyRecords((result.complete + result.incomplete) > 0 || currentFilters.search !== '' || currentFilters.completeness !== 'all')
    setStatsLoading(false)
  }, [])

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      loadRows(page, filters)
      loadStats(filters)
      return
    }
    setPage(1)
    loadRows(1, filters)
    loadStats(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, loadRows, loadStats])

  // Keep the URL in sync with the current filters/page so returning here
  // (e.g. after saving a record) restores the exact same view.
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.search)                        params.set('q', filters.search)
    if (filters.completeness !== 'incomplete') params.set('completeness', filters.completeness)
    if (filters.period !== '30')               params.set('period', filters.period)
    if (filters.sortOrder !== 'desc')          params.set('sortOrder', filters.sortOrder)
    if (filters.groupBy !== 'date')            params.set('groupBy', filters.groupBy)
    if (filters.staffId !== 'all')             params.set('staffId', filters.staffId)
    if (filters.branchId !== 'all')            params.set('branchId', filters.branchId)
    if (page !== 1)                            params.set('page', String(page))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [filters, page, pathname, router])

  function handlePage(p: number) {
    setPage(p)
    loadRows(p, filters)
  }

  function refreshCurrent() {
    loadRows(page, filters)
    loadStats(filters)
  }

  async function handleRemind(visitId: string) {
    setRemindingIds((prev) => new Set(prev).add(visitId))
    try {
      const result = await sendMedicalRecordReminder(visitId)
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        setRemindedIds((prev) => new Set(prev).add(visitId))
        showToast(result.alreadySent ? 'Pengingat sudah dikirim hari ini' : 'Pengingat terkirim ke terapis', result.alreadySent ? 'info' : 'success')
      }
    } finally {
      setRemindingIds((prev) => { const s = new Set(prev); s.delete(visitId); return s })
    }
  }

  async function handleRemindAll() {
    setRemindAllLoading(true)
    try {
      const { rows: incompleteRows } = await fetchMedicalRecords({
        page: 1, pageSize: 500,
        search: filters.search, period: filters.period,
        sortOrder: filters.sortOrder, staffId: filters.staffId, branchId: filters.branchId,
        completeness: 'incomplete',
      })
      const ids = incompleteRows.map((r) => r.id)
      if (ids.length === 0) { showToast('Tidak ada rekam medis yang belum lengkap', 'info'); return }

      const result = await sendBulkMedicalRecordReminders(ids)
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        setRemindedIds((prev) => new Set([...prev, ...ids]))
        const parts: string[] = []
        if (result.sent > 0) parts.push(`${result.sent} terkirim`)
        if (result.skipped > 0) parts.push(`${result.skipped} sudah dikirim`)
        showToast(`Pengingat rekam medis: ${parts.join(', ') || 'tidak ada yang dikirim'}`, 'success')
      }
    } finally {
      setRemindAllLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Rekam Medis</h1>
          <p className="text-sm text-muted-foreground">
            {isTeamView
              ? 'Pantau kelengkapan catatan perawatan seluruh terapis'
              : 'Kunjungan pasien Anda yang belum diisi catatan perawatan / asesmennya'}
          </p>
        </div>
      </div>

      <MedicalRecordsStats complete={stats.complete} incomplete={stats.incomplete} loading={statsLoading} />

      {isTeamView && !statsLoading && stats.incomplete > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
          <BellRing size={15} className="shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">{stats.incomplete}</span>
            {' '}kunjungan belum lengkap rekam medisnya
          </span>
          <button
            onClick={handleRemindAll}
            disabled={remindAllLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-600 dark:text-amber-400 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <BellRing size={12} />
            {remindAllLoading ? 'Mengirim...' : 'Ingatkan Semua'}
          </button>
        </div>
      )}

      <MedicalRecordsFilters
        filters={filters}
        isTeamView={isTeamView}
        isDirector={options.isDirector}
        branches={options.branches}
        staff={options.staff}
        incompleteCount={stats.incomplete}
        onChange={setFilters}
      />

      <MedicalRecordsList
        loading={loading}
        rows={rows}
        isTeamView={isTeamView}
        hasAnyRecords={hasAnyRecords}
        groupByPatient={filters.groupBy === 'patient'}
        onOpenQuickForm={setQuickFormVisitId}
        onRemind={isTeamView ? handleRemind : undefined}
        remindingIds={remindingIds}
        remindedIds={remindedIds}
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={handlePage} />

      <MedicalRecordModal
        visitId={quickFormVisitId}
        onClose={() => setQuickFormVisitId(null)}
        onSaved={() => { setQuickFormVisitId(null); refreshCurrent() }}
      />
    </div>
  )
}
