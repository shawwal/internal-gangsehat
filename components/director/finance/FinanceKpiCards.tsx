import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatRp } from './types'

interface Props {
  totalIncome: number
  totalCollected: number
  totalOutstanding: number
  totalExpense: number
  totalNet: number
}

export function FinanceKpiCards({ totalIncome, totalCollected, totalOutstanding, totalExpense, totalNet }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="glass-card p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Tagihan</p>
        <p className="text-2xl font-bold text-foreground">{formatRp(totalIncome)}</p>
        <p className="text-xs text-muted-foreground mt-1">Harga billed ke pasien</p>
      </div>
      <div className="glass-card p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Terkumpul</p>
        <p className="text-2xl font-bold text-[#34C759]">{formatRp(totalCollected)}</p>
        <p className="text-xs text-muted-foreground mt-1">Jumlah bayar diterima</p>
      </div>
      <div className="glass-card p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Outstanding</p>
        <p className="text-2xl font-bold text-[#FFB35C]">{formatRp(totalOutstanding)}</p>
        <p className="text-xs text-muted-foreground mt-1">Belum dilunasi</p>
      </div>
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {totalNet >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
          </p>
          {totalNet >= 0
            ? <TrendingUp size={16} className="text-[#34C759]" />
            : <TrendingDown size={16} className="text-destructive" />
          }
        </div>
        <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-[#34C759]' : 'text-destructive'}`}>
          {formatRp(Math.abs(totalNet))}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Keluar {formatRp(totalExpense)}</p>
      </div>
    </div>
  )
}
