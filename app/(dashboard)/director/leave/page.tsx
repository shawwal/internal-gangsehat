'use client'

import { useEffect, useState } from 'react'
import {
  CalendarOff, CalendarRange, CheckCircle2, Clock,
  ExternalLink, FileText, Users, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  reason: string
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
  internal_profiles: { full_name: string; email: string } | null
  branches: { name: string } | null
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}
const STATUS_BORDER: Record<string, string> = {
  pending: 'border-l-[var(--secondary)]',
  approved: 'border-l-[var(--chart-4)]',
  rejected: 'border-l-destructive',
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

function GlassStatCard({
  label, value, icon, color,
}: {
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

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ProofDisplay({ url }: { url: string }) {
  const isPdf = /\.pdf$/i.test(url)
  return (
    <div className="flex items-center gap-2 mt-2">
      {isPdf ? (
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText size={18} className="text-muted-foreground" />
        </div>
      ) : (
        <img
          src={url}
          alt="Bukti"
          className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Lihat Bukti <ExternalLink size={11} />
      </a>
    </div>
  )
}

export default function DirectorLeavePage() {
  const [requests, setRequests]       = useState<LeaveRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<FilterTab>('all')
  const [branchFilter, setBranchFilter] = useState('all')

  async function load() {
    const { data } = await createClient()
      .from('leave_requests')
      .select(`
        id, start_date, end_date, reason, status, rejection_note, proof_url, created_at,
        internal_profiles(full_name, email),
        branches(name)
      `)
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as unknown as LeaveRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function dayCount(start: string, end: string) {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
  }

  const pendingCount  = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  const branchNames = Array.from(
    new Set(requests.map((r) => r.branches?.name).filter(Boolean))
  ) as string[]

  const filtered = requests.filter((r) => {
    const tabMatch = activeTab === 'all' || r.status === activeTab
    const branchMatch = branchFilter === 'all' || r.branches?.name === branchFilter
    return tabMatch && branchMatch
  })

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cuti Staff</h1>
          <p className="text-sm text-muted-foreground">Pantau pengajuan cuti seluruh cabang</p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground shrink-0">
          {todayLabel}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassStatCard
          label="Total Pengajuan"
          value={requests.length}
          icon={<Users size={18} className="text-foreground" />}
          color="bg-muted"
        />
        <GlassStatCard
          label="Menunggu"
          value={pendingCount}
          icon={<Clock size={18} className="text-secondary-foreground" />}
          color="bg-secondary/20"
        />
        <GlassStatCard
          label="Disetujui"
          value={approvedCount}
          icon={<CheckCircle2 size={18} className="text-chart-4" />}
          color="bg-chart-4/15"
        />
        <GlassStatCard
          label="Ditolak"
          value={rejectedCount}
          icon={<XCircle size={18} className="text-destructive" />}
          color="bg-destructive/10"
        />
      </div>

      {/* Filters */}
      {!loading && requests.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Tab filters */}
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  activeTab === tab.key
                    ? 'bg-card shadow-sm text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.key === 'pending' && pendingCount > 0 && (
                  <span className="ml-1.5 text-xs bg-secondary/30 text-secondary-foreground px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Branch filter */}
          {branchNames.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-xl text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Semua Cabang</option>
              {branchNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-muted rounded-2xl h-28" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-2xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarOff size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {requests.length === 0 ? 'Belum ada pengajuan cuti' : 'Tidak ada hasil yang cocok'}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {requests.length === 0
              ? 'Pengajuan cuti dari staff semua cabang akan muncul di sini.'
              : 'Coba ubah filter status atau cabang.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const name = r.internal_profiles?.full_name ?? '—'
            return (
              <div
                key={r.id}
                className={`bg-card rounded-2xl border border-border border-l-[3px] p-4 ${STATUS_BORDER[r.status]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar name={name} />
                    <div className="flex-1 min-w-0">
                      {/* Name + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{name}</p>
                        <span className="text-xs text-muted-foreground">{r.internal_profiles?.email}</span>
                        {r.branches?.name && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {r.branches.name}
                          </span>
                        )}
                      </div>

                      {/* Date range */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <CalendarRange size={12} className="text-muted-foreground shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          {formatDate(r.start_date)} – {formatDate(r.end_date)}
                          <span className="ml-1.5 font-medium text-foreground">{dayCount(r.start_date, r.end_date)} hari</span>
                        </p>
                      </div>

                      {/* Reason */}
                      <p className="text-sm text-foreground mt-1">{r.reason}</p>

                      {/* Proof */}
                      {r.proof_url && <ProofDisplay url={r.proof_url} />}

                      {/* Rejection note */}
                      {r.rejection_note && (
                        <div className="flex items-start gap-1.5 mt-1.5">
                          <XCircle size={12} className="text-destructive mt-0.5 shrink-0" />
                          <p className="text-xs text-destructive">{r.rejection_note}</p>
                        </div>
                      )}

                      {/* Reviewed note */}
                      {r.status !== 'pending' && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {r.status === 'approved' ? 'Disetujui oleh HR' : 'Ditolak oleh HR'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status pill */}
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
