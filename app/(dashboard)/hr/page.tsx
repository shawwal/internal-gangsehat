'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, CalendarCheck, CalendarOff, Clock, ArrowRight, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  status: string
  internal_profiles: { full_name: string } | null
}

interface Stats {
  staffCount: number
  presentCount: number
  onLeaveCount: number
  pendingLeaveCount: number
  recentLeaves: LeaveRow[]
  today: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SkeletonCard() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-2.5 w-20 bg-muted rounded-full" />
        <div className="w-9 h-9 rounded-2xl bg-muted" />
      </div>
      <div className="h-6 w-24 bg-muted rounded-full mb-1" />
      <div className="h-2.5 w-32 bg-muted/60 rounded-full" />
    </div>
  )
}

function KpiCard({
  title, value, sub, icon, iconBg, alert = false,
}: {
  title: string; value: string | number; sub?: string
  icon: React.ReactNode; iconBg: string; alert?: boolean
}) {
  return (
    <div className={`glass-card p-5 hover:scale-[1.02] transition-transform duration-200 ${alert ? 'ring-2 ring-secondary/40' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className={`text-xs mt-1 ${alert ? 'text-secondary-foreground font-medium' : 'text-muted-foreground'}`}>{sub}</p>}
    </div>
  )
}

export default function HRPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]

      const { data: { user } } = await supabase.auth.getUser()
      const branchId = user
        ? (await supabase.from('internal_profiles').select('branch_id').eq('id', user.id).single()).data?.branch_id ?? null
        : null

      let staffQ      = supabase.from('internal_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true)
      let pendingQ    = supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      let onLeaveQ    = supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved').lte('start_date', today).gte('end_date', today)
      let attendanceQ = supabase.from('attendance').select('status').eq('date', today)
      let recentQ     = supabase.from('leave_requests').select('id, start_date, end_date, status, internal_profiles(full_name)').order('created_at', { ascending: false }).limit(5)
      if (branchId) {
        staffQ      = staffQ.eq('branch_id', branchId)
        pendingQ    = pendingQ.eq('branch_id', branchId)
        onLeaveQ    = onLeaveQ.eq('branch_id', branchId)
        attendanceQ = attendanceQ.eq('branch_id', branchId)
        recentQ     = recentQ.eq('branch_id', branchId)
      }

      const [staffRes, pendingLeaveRes, onLeaveRes, attendanceRes, recentLeaveRes] = await Promise.all([
        staffQ, pendingQ, onLeaveQ, attendanceQ, recentQ,
      ])

      const attendanceToday = attendanceRes.data ?? []
      const presentCount = attendanceToday.filter(a => a.status === 'present' || a.status === 'late').length

      setStats({
        staffCount: staffRes.count ?? 0,
        presentCount,
        onLeaveCount: onLeaveRes.count ?? 0,
        pendingLeaveCount: pendingLeaveRes.count ?? 0,
        recentLeaves: (recentLeaveRes.data ?? []) as unknown as LeaveRow[],
        today,
      })
      setLoading(false)
    }
    load()
  }, [])

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6 relative">
      {/* Decorative blob */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard HR</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ringkasan kehadiran dan permintaan cuti</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-2xl capitalize">
          {todayStr}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="Staff Aktif"
              value={stats!.staffCount}
              sub="Total terdaftar"
              icon={<Users size={16} className="text-white" />}
              iconBg="bg-primary"
            />
            <KpiCard
              title="Hadir Hari Ini"
              value={`${stats!.presentCount} / ${stats!.staffCount}`}
              sub="Hadir atau terlambat"
              icon={<UserCheck size={16} className="text-white" />}
              iconBg="bg-[var(--chart-4)]"
            />
            <KpiCard
              title="Sedang Cuti"
              value={stats!.onLeaveCount}
              sub="Cuti disetujui hari ini"
              icon={<CalendarOff size={16} className="text-white" />}
              iconBg="bg-[var(--chart-3)]"
            />
            <KpiCard
              title="Pengajuan Pending"
              value={stats!.pendingLeaveCount}
              sub={stats!.pendingLeaveCount > 0 ? 'Perlu ditinjau' : 'Tidak ada yang menunggu'}
              icon={<Clock size={16} className="text-white" />}
              iconBg={stats!.pendingLeaveCount > 0 ? 'bg-secondary' : 'bg-muted-foreground'}
              alert={stats!.pendingLeaveCount > 0}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/hr/attendance"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02]"
        >
          <CalendarCheck size={16} /> Kelola Absensi
        </Link>
        <Link
          href="/hr/leave"
          className="relative flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all duration-200 hover:scale-[1.02]"
        >
          <Clock size={16} /> Tinjau Pengajuan Cuti
          {!loading && (stats?.pendingLeaveCount ?? 0) > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center px-1">
              {stats!.pendingLeaveCount}
            </span>
          )}
        </Link>
        <Link
          href="/hr/staff"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all duration-200"
        >
          Lihat Semua Staff <ArrowRight size={14} />
        </Link>
      </div>

      {/* Recent Leave Requests */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Pengajuan Cuti Terbaru</h2>
            <p className="text-xs text-muted-foreground mt-0.5">5 pengajuan terakhir dari seluruh staff</p>
          </div>
          <Link href="/hr/leave" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            Lihat semua →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !stats?.recentLeaves.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-11 h-11 rounded-3xl bg-muted/50 flex items-center justify-center mb-3">
              <CalendarOff size={20} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Belum ada pengajuan cuti</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Pengajuan baru akan muncul di sini</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentLeaves.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/20 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Users size={14} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {r.internal_profiles?.full_name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
