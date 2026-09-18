import { Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { OrderPaymentHistoryEntry } from '@/lib/internal/orderPayments'

interface Props {
  history: OrderPaymentHistoryEntry[]
  /** Admins can correct a data-entry mistake (wrong date/amount) in place —
   *  omit to keep the read-only ledger view (e.g. for roles without payment access). */
  onEdit?: (row: OrderPaymentHistoryEntry) => void
}

// Riwayat Pembayaran — normally each row is a past payment, added to rather
// than overwritten, per the SALDO model. onEdit is an escape hatch for
// correcting a genuine data-entry mistake (wrong date/amount typed in),
// not for recording a new payment — use addPaymentToOrder for that.
export function PaymentHistoryTable({ history, onEdit }: Props) {
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
            {onEdit && <th className="w-8" />}
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
              {onEdit && (
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => onEdit(row)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit pembayaran"
                    aria-label="Edit pembayaran"
                  >
                    <Pencil size={12} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
