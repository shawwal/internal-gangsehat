import { AlertCircle } from 'lucide-react'
import { formatRp, type BranchSummary } from './types'

interface Props {
  branches: BranchSummary[]
  periodLabel: string
  totalIncome: number
  totalCollected: number
  totalOutstanding: number
  totalExpense: number
  totalNet: number
}

export function BranchSummaryTable({
  branches, periodLabel, totalIncome, totalCollected, totalOutstanding, totalExpense, totalNet,
}: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-foreground">Ringkasan Per Cabang</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{periodLabel} · tidak termasuk transaksi ditolak</p>
      </div>
      {branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <AlertCircle size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada transaksi untuk periode ini</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tagihan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terkumpul</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outstanding</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pengeluaran</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Laba / Rugi</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{b.name}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm text-foreground">{formatRp(b.income)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm text-[#34C759]">{formatRp(b.collected)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm text-[#FFB35C]">
                    {b.outstanding > 0 ? formatRp(b.outstanding) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm text-destructive">
                    {b.expense > 0 ? formatRp(b.expense) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-mono text-sm font-semibold ${b.net >= 0 ? 'text-[#34C759]' : 'text-destructive'}`}>
                      {b.net >= 0 ? '+' : '-'}{formatRp(Math.abs(b.net))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/15 bg-white/5">
                <td className="px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-foreground">{formatRp(totalIncome)}</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-[#34C759]">{formatRp(totalCollected)}</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-[#FFB35C]">{formatRp(totalOutstanding)}</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-destructive">{formatRp(totalExpense)}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`font-mono text-sm font-bold ${totalNet >= 0 ? 'text-[#34C759]' : 'text-destructive'}`}>
                    {totalNet >= 0 ? '+' : '-'}{formatRp(Math.abs(totalNet))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
