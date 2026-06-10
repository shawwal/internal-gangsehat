'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, PlusCircle, XCircle } from 'lucide-react'
import {
  fetchPatientsPage,
  fetchPatientStats,
  addPatient,
  type PatientStats as PatientStatsData,
} from '@/app/actions/patients'
import { PatientStats }   from '@/components/patients/PatientStats'
import { PatientFilters } from '@/components/patients/PatientFilters'
import { PatientCard }    from '@/components/patients/PatientCard'
import { PatientTable }   from '@/components/patients/PatientTable'
import { PatientForm, DEFAULT_PATIENT_FORM } from '@/components/patients/PatientForm'
import { PatientEmpty }   from '@/components/patients/PatientEmpty'
import { Pagination }     from '@/components/leave/Pagination'
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  type PatientPlain,
  type PatientFiltersState,
  type ViewMode,
} from '@/components/patients/types'
import type { PatientFormData } from '@/components/patients/PatientForm'

const SEARCH_DEBOUNCE_MS = 350

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientPlain[]>([])
  const [total,    setTotal]    = useState(0)
  const [stats,    setStats]    = useState<PatientStatsData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState<PatientFormData>(DEFAULT_PATIENT_FORM)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)
  const [filters,  setFilters]  = useState<PatientFiltersState>(DEFAULT_FILTERS)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [page,     setPage]     = useState(1)
  const requestId = useRef(0)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadPage(p: number, f: PatientFiltersState) {
    const id = ++requestId.current
    setLoading(true)
    const { patients: data, total } = await fetchPatientsPage({
      page:      p,
      pageSize:  PAGE_SIZE,
      gender:    f.gender,
      search:    f.search,
      sortField: f.sortField,
      sortOrder: f.sortOrder,
    })
    if (id !== requestId.current) return // a newer request superseded this one
    setPatients(data)
    setTotal(total)
    setLoading(false)
  }

  function loadStats() {
    fetchPatientStats().then(setStats)
  }

  useEffect(() => { loadStats() }, [])

  // Reload on page/filter change — debounced so search doesn't fire per keystroke
  useEffect(() => {
    const t = setTimeout(() => { loadPage(page, filters) }, filters.search ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters])

  function closeForm() {
    setShowForm(false)
    setForm(DEFAULT_PATIENT_FORM)
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const { error } = await addPatient({
      name:      form.name,
      phone:     form.phone,
      address:   form.address || undefined,
      birthDate: form.birthDate || undefined,
      gender:    form.gender,
    })
    setSaving(false)
    if (error) { showToast(error, false); return }
    showToast('Pasien berhasil ditambahkan!', true)
    closeForm()
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
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-sm cursor-pointer"
        >
          <PlusCircle size={15} />
          {showForm ? 'Tutup Form' : 'Tambah Pasien'}
        </button>
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

      {/* Add patient form */}
      {showForm && (
        <PatientForm
          form={form}
          saving={saving}
          onClose={closeForm}
          onChange={setForm}
          onSubmit={handleAdd}
        />
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
        <PatientEmpty totalPatients={totalPatients} onAdd={() => setShowForm(true)} />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => <PatientCard key={p.id} patient={p} />)}
        </div>
      ) : (
        <PatientTable patients={patients} />
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
    </div>
  )
}
