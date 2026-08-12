'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, CalendarPlus, PackagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchHomeVisitPatients, fetchHomeVisitStats } from '@/app/actions/homeVisit'
import { fetchPatient } from '@/app/actions/patients'
import type { PatientPlain } from '@/app/actions/patients'
import { BuyPackageDialog } from '@/components/jadwal/buy-package/BuyPackageDialog'
import { RecordVisitDialog } from '@/components/homeVisit/RecordVisitDialog'
import { HomeVisitStats } from '@/components/homeVisit/HomeVisitStats'
import { HomeVisitList } from '@/components/homeVisit/HomeVisitList'
import { Pagination } from '@/components/leave/Pagination'
import type { HomeVisitPatientRow, HomeVisitStatsData } from '@/components/homeVisit/types'
import type { UserRole } from '@/types'

const PAGE_SIZE = 10
const CROSS_BRANCH_ROLES: UserRole[] = ['director']

export default function HomeVisitPage() {
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)

  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [rows, setRows]       = useState<HomeVisitPatientRow[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState<HomeVisitStatsData>({ totalPatients: 0, activePackages: 0, visitsThisMonth: 0, noPackageYet: 0 })
  const [statsLoading, setStatsLoading] = useState(true)

  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [recordPatient, setRecordPatient] = useState<PatientPlain | null>(null)

  const [showBuyDialog, setShowBuyDialog] = useState(false)
  const [buyPatient, setBuyPatient] = useState<PatientPlain | null>(null)

  const showBranch = userRole ? CROSS_BRANCH_ROLES.includes(userRole) : false

  const loadRows = useCallback(async (currentPage: number, currentSearch: string) => {
    setLoading(true)
    const result = await fetchHomeVisitPatients({ search: currentSearch, page: currentPage, pageSize: PAGE_SIZE })
    setRows(result.rows)
    setTotal(result.total)
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    const result = await fetchHomeVisitStats()
    setStats(result)
    setStatsLoading(false)
  }, [])

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('branch_id, role')
        .eq('id', user.id)
        .single()
      setBranchId(profile?.branch_id ?? null)
      setUserRole((profile?.role as UserRole) ?? null)
    }
    loadProfile()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); loadRows(1, search); loadStats() }, search ? 300 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function handlePage(p: number) {
    setPage(p)
    loadRows(p, search)
  }

  function refresh() {
    loadRows(page, search)
    loadStats()
  }

  async function openRecordFor(row: HomeVisitPatientRow) {
    const patient = await fetchPatient(row.patient_id)
    if (!patient) return
    setRecordPatient(patient)
    setShowRecordDialog(true)
  }

  async function openBuyFor(row: HomeVisitPatientRow) {
    const patient = await fetchPatient(row.patient_id)
    if (!patient) return
    setBuyPatient(patient)
    setShowBuyDialog(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Home Visit</h1>
          <p className="text-sm text-muted-foreground">Kelola pasien dan paket layanan home visit</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRecordPatient(null); setShowRecordDialog(true) }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <CalendarPlus size={14} /> Catat Kunjungan
          </button>
          <button
            onClick={() => { setBuyPatient(null); setShowBuyDialog(true) }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
          >
            <PackagePlus size={14} /> Beli Paket Home Visit
          </button>
        </div>
      </div>

      <HomeVisitStats stats={stats} loading={statsLoading} />

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama pasien..."
          className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <HomeVisitList
        rows={rows}
        loading={loading}
        showBranch={showBranch}
        onRecordVisit={openRecordFor}
        onBuyPackage={openBuyFor}
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={handlePage} />

      {showRecordDialog && (
        <RecordVisitDialog
          patient={recordPatient}
          branchId={branchId}
          onClose={() => setShowRecordDialog(false)}
          onSuccess={() => { setShowRecordDialog(false); refresh() }}
        />
      )}

      {showBuyDialog && (
        <BuyPackageDialog
          branchId={branchId}
          lockedCategory="PAKET VISIT"
          title="Beli Paket Home Visit"
          subtitle="Kategori Paket Visit — sesuai Tarif Layanan"
          initialPatient={buyPatient}
          onClose={() => setShowBuyDialog(false)}
          onSuccess={() => { setShowBuyDialog(false); refresh() }}
        />
      )}
    </div>
  )
}
