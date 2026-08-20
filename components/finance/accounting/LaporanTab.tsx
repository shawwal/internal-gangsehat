'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react'
import { fetchTransactionsForRange, fetchBranchAdmins, type AccountingTxnRow, type AdminOption } from '@/app/actions/accounting'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { openPrintableReport } from '@/lib/pdf-export'
import { ExportMenu } from './ExportMenu'
import { formatRp, formatNum, inputCls } from './shared'

interface Props {
  branchId: string
  branchName: string
  dateFrom: string
  dateToExclusive: string
  periodLabel: string
  onRangeChange: (from: string, toExclusive: string, label: string) => void
}

interface RekapRow { key: string; label: string; count: number; total: number }

function KpiCard({ icon: Icon, label, value, tone }: { icon: typeof TrendingUp; label: string; value: string; tone: 'up' | 'down' | 'neutral' }) {
  const toneCls = tone === 'up' ? 'text-chart-4 bg-chart-4/10' : tone === 'down' ? 'text-destructive bg-destructive/10' : 'text-primary bg-primary/10'
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneCls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-base font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

export function LaporanTab({ branchId, branchName, dateFrom, dateToExclusive, periodLabel, onRangeChange }: Props) {
  const [txns, setTxns] = useState<AccountingTxnRow[]>([])
  const [admins, setAdmins] = useState<AdminOption[]>([])
  const [loading, setLoading] = useState(true)
  const [customFrom, setCustomFrom] = useState(dateFrom)
  const [customTo, setCustomTo] = useState(dateFrom)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchTransactionsForRange(branchId, dateFrom, dateToExclusive),
      fetchBranchAdmins(branchId),
    ]).then(([t, a]) => { setTxns(t); setAdmins(a); setLoading(false) })
  }, [branchId, dateFrom, dateToExclusive])

  const adminName = useMemo(() => {
    const m = new Map(admins.map((a) => [a.id, a.full_name]))
    return (id: string | null) => (id ? (m.get(id) ?? 'Lainnya') : 'Tidak ditentukan')
  }, [admins])

  const income = txns.filter((t) => t.type === 'income')
  const expense = txns.filter((t) => t.type === 'expense')
  const totalNilaiTransaksi = income.reduce((s, t) => s + Number(t.amount), 0)
  const totalPengeluaran = expense.reduce((s, t) => s + Number(t.amount), 0)
  const labaBersih = totalNilaiTransaksi - totalPengeluaran

  const rekapLayanan = useMemo<RekapRow[]>(() => {
    const m = new Map<string, RekapRow>()
    for (const t of income) {
      const row = m.get(t.category) ?? { key: t.category, label: t.category, count: 0, total: 0 }
      row.count += 1
      row.total += Number(t.amount)
      m.set(t.category, row)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [income])

  const rekapAdmin = useMemo<RekapRow[]>(() => {
    const m = new Map<string, RekapRow>()
    for (const t of income) {
      const key = t.fisio_id ?? '__none__'
      const row = m.get(key) ?? { key, label: adminName(t.fisio_id), count: 0, total: 0 }
      row.count += 1
      row.total += Number(t.amount)
      m.set(key, row)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [income, adminName])

  function applyCustomRange() {
    const toExclusive = new Date(new Date(customTo).getTime() + 86400000).toISOString().slice(0, 10)
    const label = customFrom === customTo ? customFrom : `${customFrom} – ${customTo}`
    onRangeChange(customFrom, toExclusive, label)
  }

  function handleExportExcel() {
    const today = new Date().toISOString().slice(0, 10)
    const cols: ExportColumn<RekapRow>[] = [
      { header: 'Nama', value: (r) => r.label },
      { header: 'Jumlah', value: (r) => r.count },
      { header: 'Total', value: (r) => r.total },
    ]
    exportToExcel(rekapLayanan, cols, `rekap_layanan_${today}`)
    exportToExcel(rekapAdmin, cols, `rekap_admin_${today}`)
  }

  function handleExportPdf() {
    openPrintableReport({
      title: 'Laporan Akuntansi',
      subtitle: periodLabel,
      meta: [
        { label: 'Cabang', value: branchName },
        { label: 'Periode', value: periodLabel },
        { label: 'Nilai Transaksi', value: formatRp(totalNilaiTransaksi) },
        { label: 'Total Pengeluaran', value: formatRp(totalPengeluaran) },
        { label: 'Laba Bersih', value: formatRp(labaBersih) },
      ],
      columns: [
        { header: 'Layanan', value: (r: RekapRow) => r.label },
        { header: 'Jumlah', align: 'center', value: (r: RekapRow) => formatNum(r.count) },
        { header: 'Nominal', align: 'right', value: (r: RekapRow) => formatRp(r.total) },
      ],
      rows: rekapLayanan,
      totalsRow: ['Total', formatNum(income.length), formatRp(totalNilaiTransaksi)],
    })
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Dari Tanggal</label>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Sampai Tanggal</label>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={inputCls} />
        </div>
        <button onClick={applyCustomRange} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Terapkan
        </button>
        <div className="ml-auto">
          <ExportMenu onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} disabled={loading} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Activity} label="Total Layanan" value={formatNum(income.length)} tone="neutral" />
            <KpiCard icon={TrendingUp} label="Nilai Transaksi" value={formatRp(totalNilaiTransaksi)} tone="up" />
            <KpiCard icon={TrendingDown} label="Total Pengeluaran" value={formatRp(totalPengeluaran)} tone="down" />
            <KpiCard icon={Wallet} label="Laba Bersih" value={formatRp(labaBersih)} tone={labaBersih >= 0 ? 'up' : 'down'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Rekap Kategori Layanan</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Layanan</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Total</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {rekapLayanan.map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-foreground">{r.label}</td>
                      <td className="px-4 py-2 text-center text-muted-foreground">{r.count}</td>
                      <td className="px-4 py-2 text-right font-medium text-chart-4">{formatRp(r.total)}</td>
                    </tr>
                  ))}
                  {!rekapLayanan.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Tidak ada data</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Rekap Transaksi per Admin</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nama</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Total</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {rekapAdmin.map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-foreground">{r.label}</td>
                      <td className="px-4 py-2 text-center text-muted-foreground">{r.count}</td>
                      <td className="px-4 py-2 text-right font-medium text-chart-4">{formatRp(r.total)}</td>
                    </tr>
                  ))}
                  {!rekapAdmin.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Tidak ada data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
