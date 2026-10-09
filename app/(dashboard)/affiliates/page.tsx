'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, Handshake, Loader2, Search, Users, X, XCircle } from 'lucide-react'
import {
  deleteAffiliate,
  fetchAffiliatesPage,
  setAffiliateStatus,
  type AffiliateRow,
  type AffiliateStats,
  type AffiliateStatus,
} from '@/app/actions/affiliates'
import { AffiliateCard, AFFILIATE_STATUS_LABEL } from '@/components/affiliates/AffiliateCard'
import { Pagination } from '@/components/leave/Pagination'

const PAGE_SIZE = 10
type StatusFilter = AffiliateStatus | 'all'
type Notice = { kind: 'success' | 'error'; text: string }

const STATUS_TABS: StatusFilter[] = ['pending', 'approved', 'inactive', 'rejected', 'all']

function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}

const SUCCESS_TEXT: Record<Exclude<AffiliateStatus, 'pending'>, string> = {
  approved: 'Afiliasi aktif — kodenya sekarang bisa dipakai di formulir pendaftaran pasien.',
  rejected: 'Pendaftaran afiliasi ditolak.',
  inactive: 'Afiliasi dinonaktifkan.',
}

export default function AffiliatesPage() {
  const [rows, setRows]       = useState<AffiliateRow[]>([])
  const [total, setTotal]     = useState(0)
  const [stats, setStats]     = useState<AffiliateStats>({ total: 0, pending: 0, approved: 0, rejected: 0, inactive: 0 })
  const [status, setStatus]   = useState<StatusFilter>('pending')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice]   = useState<Notice | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchAffiliatesPage({ status, search, page })
    setLoading(false)
    if (res.error) { setNotice({ kind: 'error', text: res.error }); return }
    setRows(res.rows)
    setTotal(res.total)
    setStats(res.stats)
  }, [status, search, page])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (searchRef.current) clearTimeout(searchRef.current) }, [])

  function handleSearch(value: string) {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => { setSearch(value); setPage(1) }, 400)
  }

  async function handleStatus(id: string, next: Exclude<AffiliateStatus, 'pending'>, note?: string) {
    const { error } = await setAffiliateStatus(id, next, note)
    setNotice(error ? { kind: 'error', text: error } : { kind: 'success', text: SUCCESS_TEXT[next] })
    await load()
  }

  async function handleDelete(id: string) {
    const { error } = await deleteAffiliate(id)
    setNotice(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Afiliasi dihapus.' })
    await load()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Handshake size={20} className="text-primary" />
          Afiliasi
        </h1>
        <p className="text-sm text-muted-foreground">
          Pendaftaran afiliasi dari gangsehat.com/daftar/afiliasi — kode hanya bisa dipakai pasien setelah disetujui.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Afiliasi" value={stats.total}
          icon={<Users size={18} className="text-foreground" />} color="bg-muted" />
        <StatCard label="Menunggu" value={stats.pending}
          icon={<Clock size={18} className="text-secondary-foreground" />} color="bg-secondary/20" />
        <StatCard label="Aktif" value={stats.approved}
          icon={<CheckCircle2 size={18} className="text-chart-4" />} color="bg-chart-4/15" />
        <StatCard label="Ditolak / Nonaktif" value={stats.rejected + stats.inactive}
          icon={<XCircle size={18} className="text-destructive" />}
          color="bg-destructive/10" />
      </div>

      {notice && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm ${
          notice.kind === 'success'
            ? 'bg-chart-4/10 border-chart-4/30 text-foreground'
            : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {notice.kind === 'success' && <CheckCircle2 size={16} className="text-chart-4 shrink-0 mt-0.5" />}
          <p className="flex-1">{notice.text}</p>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setStatus(tab); setPage(1) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                status === tab
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'all' ? 'Semua' : AFFILIATE_STATUS_LABEL[tab]}
              {tab === 'pending' && stats.pending > 0 && (
                <span className="ml-1.5 text-[11px] font-bold">({stats.pending})</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari kode, nama, No. HP, atau kota..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada afiliasi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <AffiliateCard key={row.id} row={row} onStatus={handleStatus} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
    </div>
  )
}
