'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchHomeVisitSessions, fetchHomeVisitStats } from '@/app/actions/homeVisit'
import { NewSessionDialog, type NewSessionResult } from '@/components/homeVisit/NewSessionDialog'
import { PaymentDialog, type PaymentVisitInfo } from '@/components/visits/PaymentDialog'
import { HomeVisitStats } from '@/components/homeVisit/HomeVisitStats'
import { HomeVisitSessionLog } from '@/components/homeVisit/HomeVisitSessionLog'
import { Pagination } from '@/components/leave/Pagination'
import type { HomeVisitSessionRow, HomeVisitStatsData } from '@/components/homeVisit/types'
import type { UserRole } from '@/types'

const PAGE_SIZE = 10
const CROSS_BRANCH_ROLES: UserRole[] = ['director']
const PAYMENT_ROLES: UserRole[] = ['finance', 'manager', 'director', 'admin']

export default function HomeVisitPage() {
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)

  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [rows, setRows]       = useState<HomeVisitSessionRow[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState<HomeVisitStatsData>({ totalPatients: 0, activePackages: 0, visitsThisMonth: 0, noPackageYet: 0 })
  const [statsLoading, setStatsLoading] = useState(true)

  const [showNewSession, setShowNewSession] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<PaymentVisitInfo | null>(null)

  const showBranch = userRole ? CROSS_BRANCH_ROLES.includes(userRole) : false
  const canRecordPayment = userRole ? PAYMENT_ROLES.includes(userRole) : false

  const loadRows = useCallback(async (currentPage: number, currentSearch: string) => {
    setLoading(true)
    const result = await fetchHomeVisitSessions({ search: currentSearch, page: currentPage, pageSize: PAGE_SIZE })
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

  function handleSessionCreated(result: NewSessionResult) {
    setShowNewSession(false)
    refresh()
    if (result.needsPayment && canRecordPayment) {
      setPendingPayment({
        id:                   result.id,
        patient_id:           result.patient_id,
        patient_name:         result.patient_name,
        visit_date:           result.visit_date,
        service_type:         result.service_type,
        branch_id:            result.branch_id,
        attending_staff_name: result.attending_staff_name ?? undefined,
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daily Session Log</h1>
          <p className="text-sm text-muted-foreground">Kelola sesi dan paket layanan home visit</p>
        </div>
        <button
          onClick={() => setShowNewSession(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> New Session
        </button>
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

      <HomeVisitSessionLog rows={rows} loading={loading} showBranch={showBranch} />

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={handlePage} />

      {showNewSession && (
        <NewSessionDialog
          branchId={branchId}
          onClose={() => setShowNewSession(false)}
          onSuccess={handleSessionCreated}
        />
      )}

      {pendingPayment && (
        <PaymentDialog
          visit={pendingPayment}
          onClose={() => setPendingPayment(null)}
          onSuccess={() => { setPendingPayment(null); refresh() }}
        />
      )}
    </div>
  )
}
