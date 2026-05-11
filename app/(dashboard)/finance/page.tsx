'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, FileText, Plus, ArrowRight, CalendarOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Report {
  id: string
  period_year: number
  period_month: number
  status: string
  total_income: number
  net_profit: number
}

interface Stats {
  income: number
  expense: number
  profit: number
  pendingCount: number
  reports: Report[]
  profileName: string
  hasBranch: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Terkirim', approved: 'Disetujui', rejected: 'Ditolak',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function SkeletonCard() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-2.5 w-20 bg-muted rounded-full" />
        <div className="w-9 h-9 rounded-2xl bg-muted" />
      </div>
      <div className="h-6 w-32 bg-muted rounded-full mb-1" />
      <div className="h-2.5 w-24 bg-muted/60 rounded-full" />
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
    <div className={`glass-card p-5 hover:scale-[1.02] transition-transform duration-200 ${alert ? 'ring-2 ring-destructive/30' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground truncate">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {alert && (
        <p className="text-xs text-destructive mt-1 font-medium">Perlu ditinjau</p>
      )}
    </div>
  )
}

export default function FinancePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase
        .from('internal_profiles')
        .select('full_name, branch_id')
        .eq('id', user.id)
        .single()

      const now = new Date()
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const [incomeRes, expenseRes, pendingRes, reportsRes] = await Promise.all([
        supabase.from('transactions')
          .select('amount')
          .eq('type', 'income').eq('status', 'confirmed')
          .gte('transaction_date', firstDay),
        supabase.from('transactions')
          .select('amount')
          .eq('type', 'expense').eq('status', 'confirmed')
          .gte('transaction_date', firstDay),
        supabase.from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('branch_financial_reports')
          .select('id, period_year, period_month, status, total_income, net_profit')
          .order('period_year', { ascending: false })
          .order('period_month', { ascending: false })
          .limit(3),
      ])

      const income  = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const expense = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

      setStats({
        income,
        expense,
        profit: income - expense,
        pendingCount: pendingRes.count ?? 0,
        reports: (reportsRes.data ?? []) as Report[],
        profileName: prof?.full_name ?? 'Pengguna',
        hasBranch: !!prof?.branch_id,
      })
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 relative">
      {/* Decorative blob */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          {loading ? (
            <div className="h-6 w-56 bg-muted rounded-full animate-pulse mb-1" />
          ) : (
            <h1 className="text-xl font-bold text-foreground">
              Selamat datang, {stats?.profileName} 👋
            </h1>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">Ringkasan keuangan bulan ini</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-2xl capitalize">
          {monthLabel}
        </span>
      </div>

      {/* No-branch warning */}
      {!loading && !stats?.hasBranch && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-secondary/10 border border-secondary/30">
          <AlertCircle size={18} className="text-secondary-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-secondary-foreground">
            Akun Anda belum terhubung ke cabang manapun. Hubungi HR untuk pengaturan cabang.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              title="Pemasukan Bulan Ini"
              value={formatRp(stats!.income)}
              sub="Transaksi dikonfirmasi"
              icon={<TrendingUp size={16} className="text-white" />}
              iconBg="bg-[var(--chart-4)]"
            />
            <KpiCard
              title="Pengeluaran Bulan Ini"
              value={formatRp(stats!.expense)}
              sub="Transaksi dikonfirmasi"
              icon={<TrendingDown size={16} className="text-white" />}
              iconBg="bg-destructive"
            />
            <KpiCard
              title="Laba Bersih Bulan Ini"
              value={formatRp(stats!.profit)}
              sub={stats!.profit >= 0 ? 'Untung' : 'Rugi'}
              icon={<DollarSign size={16} className="text-white" />}
              iconBg={stats!.profit >= 0 ? 'bg-primary' : 'bg-destructive'}
            />
            <KpiCard
              title="Transaksi Menunggu"
              value={stats!.pendingCount}
              icon={<AlertCircle size={16} className="text-white" />}
              iconBg={stats!.pendingCount > 0 ? 'bg-secondary' : 'bg-muted-foreground'}
              alert={stats!.pendingCount > 0}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/finance/transactions"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02]"
        >
          <Plus size={16} /> Tambah Transaksi
        </Link>
        <Link
          href="/finance/reports"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all duration-200 hover:scale-[1.02]"
        >
          <FileText size={16} /> Generate Laporan
        </Link>
        <Link
          href="/finance/transactions"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all duration-200"
        >
          Lihat Semua Transaksi <ArrowRight size={14} />
        </Link>
      </div>

      {/* Recent Reports */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Laporan Terbaru</h2>
            <p className="text-xs text-muted-foreground mt-0.5">3 laporan terakhir yang dikirim</p>
          </div>
          <Link href="/finance/reports" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            Lihat semua →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !stats?.reports.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-11 h-11 rounded-3xl bg-muted/50 flex items-center justify-center mb-3">
              <CalendarOff size={20} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Belum ada laporan</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Buat laporan bulanan pertama Anda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.reports.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/20 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {MONTH_NAMES[r.period_month - 1]} {r.period_year}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRp(r.net_profit)}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
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
