import { createClient } from '@/lib/supabase/server'
import { Users, TrendingUp, TrendingDown, DollarSign, Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface KpiCard {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
}

function StatCard({ title, value, icon, color }: KpiCard) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default async function DirectorOverviewPage() {
  const supabase = await createClient()

  const [
    { count: totalPatients },
    { count: totalStaff },
    { count: activeBranches },
    { data: incomeData },
    { data: expenseData },
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('internal_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('transactions').select('amount').eq('type', 'income').eq('status', 'confirmed'),
    supabase.from('transactions').select('amount').eq('type', 'expense').eq('status', 'confirmed'),
  ])

  const totalIncome  = (incomeData ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpense = (expenseData ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const netProfit    = totalIncome - totalExpense

  const { data: pendingReports } = await supabase
    .from('branch_financial_reports')
    .select('id, period_year, period_month, branches(name), submitted_at')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">Ringkasan kinerja seluruh cabang</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Pasien"
          value={totalPatients ?? 0}
          icon={<Users size={16} className="text-white" />}
          color="bg-primary"
        />
        <StatCard
          title="Staff Aktif"
          value={totalStaff ?? 0}
          icon={<Users size={16} className="text-white" />}
          color="bg-chart-2"
        />
        <StatCard
          title="Cabang Aktif"
          value={activeBranches ?? 0}
          icon={<Building2 size={16} className="text-white" />}
          color="bg-chart-3"
        />
        <StatCard
          title="Total Pemasukan"
          value={formatRp(totalIncome)}
          icon={<TrendingUp size={16} className="text-white" />}
          color="bg-chart-4"
        />
        <StatCard
          title="Net Profit"
          value={formatRp(netProfit)}
          icon={netProfit >= 0 ? <DollarSign size={16} className="text-white" /> : <TrendingDown size={16} className="text-white" />}
          color={netProfit >= 0 ? 'bg-chart-4' : 'bg-destructive'}
        />
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Laporan Menunggu Persetujuan</h2>
        {!pendingReports?.length ? (
          <p className="text-sm text-muted-foreground">Tidak ada laporan yang menunggu.</p>
        ) : (
          <div className="space-y-2">
            {pendingReports.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <p className="text-sm font-medium text-foreground">{(r.branches as any)?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.period_month}/{r.period_year}
                  </p>
                </div>
                <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                  Menunggu
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
