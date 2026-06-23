'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, PlusCircle, Trash2, XCircle } from 'lucide-react'
import {
  fetchPatientsPage,
  fetchPatientsPageWithStats,
  fetchPatientStats,
  deletePatient,
  type PatientStats as PatientStatsData,
} from '@/app/actions/patients'
import { PatientStats }   from '@/components/patients/PatientStats'
import { PatientFilters } from '@/components/patients/PatientFilters'
import { PatientCard }    from '@/components/patients/PatientCard'
import { PatientTable }   from '@/components/patients/PatientTable'
import { PatientEmpty }   from '@/components/patients/PatientEmpty'
import { Pagination }     from '@/components/leave/Pagination'
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  AVATAR_COLORS,
  getInitials,
  type PatientPlain,
  type PatientFiltersState,
  type ViewMode,
} from '@/components/patients/types'

const SEARCH_DEBOUNCE_MS = 350

export default function PatientsPage() {
  const router = useRouter()
  const [patients, setPatients] = useState<PatientPlain[]>([])
  const [total,    setTotal]    = useState(0)
  const [stats,    setStats]    = useState<PatientStatsData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)
  const [filters,  setFilters]  = useState<PatientFiltersState>(DEFAULT_FILTERS)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [page,     setPage]     = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<PatientPlain | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const requestId       = useRef(0)
  const initialLoadDone = useRef(false)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadPage(p: number, f: PatientFiltersState) {
    const id = ++requestId.current
    setLoading(true)

    // First load: fetch stats and first page in one server round-trip
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      const { patients: data, total, stats } = await fetchPatientsPageWithStats({
        page:      p,
        pageSize:  PAGE_SIZE,
        gender:    f.gender,
        search:    f.search,
        sortField: f.sortField,
        sortOrder: f.sortOrder,
      })
      if (id !== requestId.current) return
      setPatients(data)
      setTotal(total)
      setStats(stats)
      setLoading(false)
      return
    }

    const { patients: data, total } = await fetchPatientsPage({
      page:      p,
      pageSize:  PAGE_SIZE,
      gender:    f.gender,
      search:    f.search,
      sortField: f.sortField,
      sortOrder: f.sortOrder,
    })
    if (id !== requestId.current) return
    setPatients(data)
    setTotal(total)
    setLoading(false)
  }

  function loadStats() {
    fetchPatientStats().then(setStats)
  }

  // Reload on page/filter change — debounced so search doesn't fire per keystroke
  useEffect(() => {
    const t = setTimeout(() => { loadPage(page, filters) }, filters.search ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters])

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await deletePatient(deleteTarget.id)
    setDeleting(false)
    if (error) { showToast(error, false); setDeleteTarget(null); return }
    showToast('Pasien berhasil dihapus.', true)
    setDeleteTarget(null)
    loadPage(page, filters)
    loadStats()
  }

  // Reset page when filters change
  function handleFiltersChange(next: PatientFiltersState) {
    setFilters(next)
    setPage(1)
  }

  function handleViewMode(mode: ViewMode) {
    setViewMode(mode)
    setPage(1)
  }

  const totalPatients = stats?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pasien</h1>
          <p className="text-sm text-muted-foreground">Kelola data pasien klinik</p>
        </div>
        <Link
          href="/patients/new?source=patients"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 shrink-0 shadow-sm"
        >
          <PlusCircle size={15} />
          Tambah Pasien
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
          toast.ok
            ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <PatientStats stats={stats} loading={stats === null} />

      {/* Filters */}
      {totalPatients > 0 && (
        <PatientFilters
          filters={filters}
          viewMode={viewMode}
          total={totalPatients}
          filtered={total}
          onChange={handleFiltersChange}
          onViewMode={handleViewMode}
        />
      )}

      {/* Content */}
      {loading ? (
        /* Skeleton */
        viewMode === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-muted rounded-3xl h-28" />
            ))}
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse h-12 bg-muted/60 m-3 rounded-xl" />
            ))}
          </div>
        )
      ) : patients.length === 0 ? (
        <PatientEmpty totalPatients={totalPatients} onAdd={() => router.push('/patients/new?source=patients')} />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => <PatientCard key={p.id} patient={p} onDelete={setDeleteTarget} />)}
        </div>
      ) : (
        <PatientTable patients={patients} onDelete={setDeleteTarget} />
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={setPage}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { if (!deleting) setDeleteTarget(null) }}
        >
          <div
            className="glass-card p-6 max-w-sm w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Hapus Pasien</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-2xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                AVATAR_COLORS[deleteTarget.gender ?? 'other']
              }`}>
                {getInitials(deleteTarget.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{deleteTarget.name}</p>
                {deleteTarget.no_rm && (
                  <p className="text-xs text-muted-foreground font-mono">{deleteTarget.no_rm}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Data pasien akan dihapus secara permanen dari sistem dan{' '}
              <span className="font-semibold text-foreground">tidak dapat dipulihkan</span> melalui aplikasi ini.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {deleting
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
                {deleting ? 'Menghapus...' : 'Hapus Pasien'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
