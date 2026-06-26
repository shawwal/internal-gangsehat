'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, DollarSign, Users, TrendingUp, Plus, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Campaign {
  id: string
  title: string
  status: string
  channel: string | null
  budget: number
  actual_spend: number
  start_date: string | null
  end_date: string | null
}

interface Stats {
  activeCampaigns: number
  totalBudget: number
  totalSpend: number
  totalReach: number
  budgetUsage: number
  recentCampaigns: Campaign[]
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Aktif', completed: 'Selesai', cancelled: 'Dibatalkan',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-primary/15 text-primary',
  completed: 'bg-chart-4/15 text-chart-4',
  cancelled: 'bg-destructive/10 text-destructive',
}
const CHANNEL_LABEL: Record<string, string> = {
  social_media: 'Sosmed', whatsapp: 'WhatsApp', email: 'Email', flyer: 'Flyer', other: 'Lainnya',
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatRpCompact(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function SkeletonCard() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-2.5 w-20 bg-muted rounded-full" />
        <div className="w-9 h-9 rounded-2xl bg-muted" />
      </div>
      <div className="h-6 w-24 bg-muted rounded-full mb-1" />
      <div className="h-2 bg-muted/40 rounded-full mt-2" />
    </div>
  )
}

function KpiCard({
  title, value, sub, icon, iconBg, budgetUsage,
}: {
  title: string; value: string | number; sub?: string
  icon: React.ReactNode; iconBg: string; budgetUsage?: number
}) {
  return (
    <div className="glass-card p-5 hover:scale-[1.02] transition-transform duration-200">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground truncate">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {budgetUsage !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.min(budgetUsage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{budgetUsage.toFixed(0)}% dari anggaran terpakai</p>
        </div>
      )}
    </div>
  )
}

export default function MarketingPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      const branchId = user
        ? (await supabase.from('internal_profiles').select('branch_id').eq('id', user.id).single()).data?.branch_id ?? null
        : null

      let activeQ  = supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active')
      let allQ     = supabase.from('campaigns').select('budget, actual_spend, actual_reach, status')
      let recentQ  = supabase.from('campaigns').select('id, title, status, channel, budget, actual_spend, start_date, end_date').order('created_at', { ascending: false }).limit(4)
      if (branchId) {
        activeQ = activeQ.eq('branch_id', branchId)
        allQ    = allQ.eq('branch_id', branchId)
        recentQ = recentQ.eq('branch_id', branchId)
      }

      const [activeRes, allRes, recentRes] = await Promise.all([activeQ, allQ, recentQ])

      const all = allRes.data ?? []
      const totalBudget = all.reduce((s, c) => s + Number(c.budget || 0), 0)
      const totalSpend  = all.reduce((s, c) => s + Number(c.actual_spend || 0), 0)
      const totalReach  = all.reduce((s, c) => s + Number(c.actual_reach || 0), 0)
      const budgetUsage = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0

      setStats({
        activeCampaigns: activeRes.count ?? 0,
        totalBudget,
        totalSpend,
        totalReach,
        budgetUsage,
        recentCampaigns: (recentRes.data ?? []) as Campaign[],
      })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6 relative">
      {/* Decorative blob */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard Marketing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pantau kinerja kampanye dan anggaran Anda</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="Kampanye Aktif"
              value={stats!.activeCampaigns}
              sub="Sedang berjalan"
              icon={<Megaphone size={16} className="text-white" />}
              iconBg="bg-primary"
            />
            <KpiCard
              title="Total Anggaran"
              value={formatRpCompact(stats!.totalBudget)}
              sub="Semua kampanye"
              icon={<DollarSign size={16} className="text-white" />}
              iconBg="bg-[var(--chart-2)]"
            />
            <KpiCard
              title="Total Pengeluaran"
              value={formatRpCompact(stats!.totalSpend)}
              icon={<TrendingUp size={16} className="text-white" />}
              iconBg={stats!.budgetUsage > 90 ? 'bg-destructive' : 'bg-[var(--chart-4)]'}
              budgetUsage={stats!.budgetUsage}
            />
            <KpiCard
              title="Total Jangkauan"
              value={stats!.totalReach > 0 ? stats!.totalReach.toLocaleString('id-ID') : '—'}
              sub="Actual reach"
              icon={<Users size={16} className="text-white" />}
              iconBg="bg-[var(--chart-3)]"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/marketing/campaigns"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02]"
        >
          <Plus size={16} /> Kampanye Baru
        </Link>
        <Link
          href="/marketing/campaigns"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all duration-200"
        >
          Lihat Semua Kampanye <ArrowRight size={14} />
        </Link>
      </div>

      {/* Recent Campaigns */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Kampanye Terbaru</h2>
            <p className="text-xs text-muted-foreground mt-0.5">4 kampanye terakhir yang dibuat</p>
          </div>
          <Link href="/marketing/campaigns" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            Lihat semua →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !stats?.recentCampaigns.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-11 h-11 rounded-3xl bg-muted/50 flex items-center justify-center mb-3">
              <Megaphone size={20} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Belum ada kampanye</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Buat kampanye pertama Anda sekarang</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.recentCampaigns.map(c => (
              <div key={c.id} className="bg-muted/20 rounded-2xl p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-foreground truncate flex-1">{c.title}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {c.channel && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-xl">
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatRp(c.actual_spend)} / {formatRp(c.budget)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
