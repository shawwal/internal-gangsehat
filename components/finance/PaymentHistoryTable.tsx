import { formatCurrency } from '@/lib/utils'
import type { OrderPaymentHistoryEntry } from '@/lib/internal/orderPayments'

interface Props {
  history: OrderPaymentHistoryEntry[]
}

// Riwayat Pembayaran — each row is a past payment, never overwritten. Shows
// the running balance ("sisa") after each payment, per the SALDO model.
export function PaymentHistoryTable({ history }: Props) {
  if (history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-1">Belum ada pembayaran tercatat.</p>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/40">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tanggal</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Keterangan</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Nominal</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Sisa</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2 whitespace-nowrap text-foreground/80">
                {new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
              </td>
              <td className="px-3 py-2 text-foreground/80">
                {row.keterangan}{row.method ? ` · ${row.method}` : ''}
              </td>
              <td className="px-3 py-2 text-right font-mono text-[#34C759]">{formatCurrency(row.nominal)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                {formatCurrency(row.sisaAfter)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
