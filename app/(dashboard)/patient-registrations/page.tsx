'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, CheckSquare, Loader2, UserCheck, X } from 'lucide-react'
import {
  bulkApproveRegistrations,
  deleteRegistrations,
  fetchRegistrationsPage,
  rejectRegistration,
  type RegistrationRow,
  type RegistrationStats as Stats,
} from '@/app/actions/patientRegistrations'
import { RegistrationStats } from '@/components/patient-registrations/RegistrationStats'
import { RegistrationFilters } from '@/components/patient-registrations/RegistrationFilters'
import { RegistrationCard } from '@/components/patient-registrations/RegistrationCard'
import { ReviewDialog } from '@/components/patient-registrations/ReviewDialog'
import { RegistrationSelectToolbar } from '@/components/patient-registrations/RegistrationSelectToolbar'
import { Pagination } from '@/components/leave/Pagination'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import {
  DEFAULT_FILTERS, PAGE_SIZE, type RegistrationFilterState,
} from '@/components/patient-registrations/types'

type Notice = { kind: 'success' | 'error'; text: string; href?: string; linkLabel?: string }
type BulkAction = 'approve' | 'delete'

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
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState<BulkAction | null>(null)
  const [bulkBusy, setBulkBusy]     = useState(false)

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  const pendingSelected = rows.filter(r => selected.has(r.id) && r.status === 'pending')

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    setSelected(new Set())
  }

  function handlePage(next: number) {
    setPage(next)
    setSelected(new Set())
  }

  async function handleDelete(id: string) {
    const { error } = await deleteRegistrations([id])
    setNotice(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Pendaftaran dihapus.' })
    await load()
  }

  async function handleBulk() {
    if (!bulkConfirm) return
    setBulkBusy(true)
    if (bulkConfirm === 'approve') {
      const res = await bulkApproveRegistrations(pendingSelected.map(r => r.id))
      if (res.error) setNotice({ kind: 'error', text: res.error })
      else if (res.failed.length > 0) {
        setNotice({
          kind: 'error',
          text: `${res.approved} disetujui, ${res.failed.length} gagal: ` +
            res.failed.map(f => `${f.name} (${f.error})`).join('; '),
        })
      } else setNotice({ kind: 'success', text: `${res.approved} pendaftaran disetujui dan ditambahkan sebagai pasien.` })
    } else {
      const res = await deleteRegistrations(Array.from(selected))
      setNotice(res.error
        ? { kind: 'error', text: res.error }
        : { kind: 'success', text: `${res.deleted} pendaftaran dihapus.` })
    }
    setBulkBusy(false)
    setBulkConfirm(null)
    exitSelectMode()
    await load()
  }

  async function handleReject(id: string, note: string) {
    const { error } = await rejectRegistration(id, note)
    setNotice(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Pendaftaran ditolak.' })
    await load()
  }

  async function handleReviewDone(patientId: string | null) {
    const name = reviewing?.name ?? ''
    const isGriya = reviewing?.isGriya ?? false
    setReviewing(null)
    setNotice(patientId
      ? {
          kind: 'success',
          text: `"${name}" berhasil ditambahkan sebagai ${isGriya ? 'pasien & siswa Griya Anak' : 'pasien'}.`,
          href: isGriya ? `/griya-anak/siswa/${patientId}` : `/patients/${patientId}`,
          linkLabel: isGriya ? 'Lihat data siswa' : 'Lihat data pasien',
        }
      : { kind: 'success', text: 'Perubahan data pendaftaran disimpan.' })
    await load()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <UserCheck size={20} className="text-primary" />
          Pendaftaran Pasien
        </h1>
        <p className="text-sm text-muted-foreground">
          Pendaftaran online dari gangsehat.com — tinjau, perbaiki, lalu setujui menjadi pasien.
        </p>
      </div>
        {!loading && rows.length > 0 && (
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <CheckSquare size={13} />
            {selectMode ? 'Selesai Pilih' : 'Pilih'}
          </button>
        )}
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
            {notice.href && (
              <>
                {' '}
                <Link href={notice.href} className="font-medium text-primary underline">
                  {notice.linkLabel}
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

      {selectMode && !loading && rows.length > 0 && (
        <RegistrationSelectToolbar
          allSelected={allSelected}
          selectedCount={selected.size}
          pendingSelectedCount={pendingSelected.length}
          onToggleAll={() => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))}
          onBulkApprove={() => setBulkConfirm('approve')}
          onBulkDelete={() => setBulkConfirm('delete')}
        />
      )}

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
              onDelete={handleDelete}
              isSelected={selected.has(row.id)}
              onToggle={selectMode ? toggleOne : undefined}
            />
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={handlePage} />

      {reviewing && (
        <ReviewDialog
          row={reviewing}
          onClose={() => setReviewing(null)}
          onDone={handleReviewDone}
        />
      )}

      {bulkConfirm && (
        <ConfirmDialog
          title={bulkConfirm === 'approve' ? 'Setujui Pendaftaran' : 'Hapus Pendaftaran'}
          description={bulkConfirm === 'approve'
            ? `${pendingSelected.length} pendaftaran akan disetujui apa adanya (tanpa No. RM) dan ditambahkan sebagai pasien.` +
              (pendingSelected.some(r => r.isGriya) ? ' Pendaftaran cabang Griya Anak juga didaftarkan sebagai siswa Griya Anak.' : '') +
              (pendingSelected.some(r => r.duplicatePatientId) ? ' Perhatian: sebagian No. HP sudah terdaftar pada pasien lain.' : '')
            : `${selected.size} pendaftaran akan dihapus permanen. Data pasien yang sudah dibuat tidak ikut terhapus.`}
          confirmLabel={bulkConfirm === 'approve' ? `Setujui ${pendingSelected.length}` : `Hapus ${selected.size}`}
          danger={bulkConfirm === 'delete'}
          loading={bulkBusy}
          onConfirm={handleBulk}
          onCancel={() => setBulkConfirm(null)}
        />
      )}
    </div>
  )
}
