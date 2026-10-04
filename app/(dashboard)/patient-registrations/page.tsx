'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, UserCheck, X } from 'lucide-react'
import {
  fetchRegistrationsPage,
  rejectRegistration,
  type RegistrationRow,
  type RegistrationStats as Stats,
} from '@/app/actions/patientRegistrations'
import { RegistrationStats } from '@/components/patient-registrations/RegistrationStats'
import { RegistrationFilters } from '@/components/patient-registrations/RegistrationFilters'
import { RegistrationCard } from '@/components/patient-registrations/RegistrationCard'
import { ReviewDialog } from '@/components/patient-registrations/ReviewDialog'
import { Pagination } from '@/components/leave/Pagination'
import {
  DEFAULT_FILTERS, PAGE_SIZE, type RegistrationFilterState,
} from '@/components/patient-registrations/types'

type Notice = { kind: 'success' | 'error'; text: string; patientId?: string }

export default function PatientRegistrationsPage() {
  const [rows, setRows]             = useState<RegistrationRow[]>([])
  const [total, setTotal]           = useState(0)
  const [stats, setStats]           = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [branches, setBranches]     = useState<{ id: string; name: string }[]>([])
  const [isDirector, setIsDirector] = useState(false)
  const [filters, setFilters]       = useState<RegistrationFilterState>(DEFAULT_FILTERS)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [reviewing, setReviewing]   = useState<RegistrationRow | null>(null)
  const [notice, setNotice]         = useState<Notice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchRegistrationsPage({ ...filters, page })
    setLoading(false)
    if (res.error) { setNotice({ kind: 'error', text: res.error }); return }
    setRows(res.rows)
    setTotal(res.total)
    setStats(res.stats)
    setIsDirector(res.isDirector)
    if (res.isDirector) setBranches(res.branches)
  }, [filters, page])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function handleFilters(next: RegistrationFilterState) {
    setFilters(next)
    setPage(1)
  }

  async function handleReject(id: string, note: string) {
    const { error } = await rejectRegistration(id, note)
    setNotice(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Pendaftaran ditolak.' })
    await load()
  }

  async function handleReviewDone(patientId: string | null) {
    const name = reviewing?.name ?? ''
    setReviewing(null)
    setNotice(patientId
      ? { kind: 'success', text: `"${name}" berhasil ditambahkan sebagai pasien.`, patientId }
      : { kind: 'success', text: 'Perubahan data pendaftaran disimpan.' })
    await load()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <UserCheck size={20} className="text-primary" />
          Pendaftaran Pasien
        </h1>
        <p className="text-sm text-muted-foreground">
          Pendaftaran online dari gangsehat.com — tinjau, perbaiki, lalu setujui menjadi pasien.
        </p>
      </div>

      <RegistrationStats stats={stats} />

      {notice && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm ${
          notice.kind === 'success'
            ? 'bg-chart-4/10 border-chart-4/30 text-foreground'
            : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {notice.kind === 'success' && <CheckCircle2 size={16} className="text-chart-4 shrink-0 mt-0.5" />}
          <p className="flex-1">
            {notice.text}
            {notice.patientId && (
              <>
                {' '}
                <Link href={`/patients/${notice.patientId}`} className="font-medium text-primary underline">
                  Lihat data pasien
                </Link>
              </>
            )}
          </p>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      <RegistrationFilters
        filters={filters}
        branches={branches}
        showBranch={isDirector}
        pendingCount={stats.pending}
        onChange={handleFilters}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada pendaftaran.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <RegistrationCard
              key={row.id}
              row={row}
              showBranch={isDirector}
              onReview={setReviewing}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {reviewing && (
        <ReviewDialog
          row={reviewing}
          onClose={() => setReviewing(null)}
          onDone={handleReviewDone}
        />
      )}
    </div>
  )
}
