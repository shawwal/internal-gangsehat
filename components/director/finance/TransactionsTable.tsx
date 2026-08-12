import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { ReclassifyButton } from './ReclassifyButton'
import { EditTransactionSheet, type TransactionForEdit } from './EditTransactionSheet'
import {
  buildFinanceUrl, formatRp, TX_STATUS_BADGE, TX_STATUS_LABEL, PAY_STATUS_BADGE, type TransactionRow,
} from './types'

const CLINICAL_INCOME_CATEGORIES = new Set([
  'TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT',
])

interface Props {
  txns: TransactionRow[]
  showBranchColumn: boolean
  q: string
  baseParams: Record<string, string>
}

export function TransactionsTable({ txns, showBranchColumn, q, baseParams }: Props) {
  if (txns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-2">
        <AlertCircle size={28} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {q ? `Tidak ada transaksi untuk "${q}"` : 'Tidak ada transaksi untuk filter ini'}
        </p>
        <Link
          href={buildFinanceUrl(baseParams, { q: undefined, tx_type: undefined, no_patient: undefined, status: undefined, pay_status: undefined, page: undefined })}
          className="text-xs text-primary hover:underline mt-1"
        >
          Hapus filter
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tanggal</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategori</th>
            {showBranchColumn && (
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cabang</th>
            )}
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pasien / Keterangan</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bayar</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pembayaran</th>
            <th className="px-3 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {txns.map((tx) => {
            const isClinicalIncome = tx.type === 'income' && CLINICAL_INCOME_CATEGORIES.has(tx.category)
            // Reclassify only makes sense for LAINNYA income without a patient
            const showReclassify = !tx.patient_name && tx.type === 'income' && tx.category === 'LAINNYA'
            // Clinical income without patient: show a warning indicator instead
            const showMissingPatient = !tx.patient_name && isClinicalIncome

            const editTx: TransactionForEdit = {
              id:               tx.id,
              type:             tx.type,
              category:         tx.category,
              harga:            tx.harga,
              discount:         tx.discount,
              amount:           tx.amount,
              payment_method:   tx.payment_method,
              payment_status:   tx.payment_status,
              penjamin:         tx.penjamin,
              description:      tx.description,
              transaction_date: tx.transaction_date,
              patient_id:       tx.patient_id,
              patient_name:     tx.patient_name,
            }

            return (
            <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
              <td className="px-5 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                {new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-[#34C759]' : 'bg-destructive'}`} />
                  <span className="text-xs font-medium text-foreground">{tx.category}</span>
                </div>
              </td>
              {showBranchColumn && (
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{tx.branch_name}</td>
              )}
              <td className="px-4 py-3 max-w-45">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {tx.patient_name ? (
                      <span className="text-xs text-foreground/90">{tx.patient_name}</span>
                    ) : tx.description ? (
                      <span className="text-xs text-muted-foreground truncate block">{tx.description}</span>
                    ) : tx.penjamin ? (
                      <span className="text-xs text-muted-foreground/60">{tx.penjamin}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </div>
                  {/* Clinical income missing patient → assign prompt */}
                  {showMissingPatient && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#FFB35C]/15 border border-[#FFB35C]/30 text-[#FFB35C] font-semibold whitespace-nowrap">
                      Tanpa pasien
                    </span>
                  )}
                  {/* Reclassify: only for LAINNYA income without patient */}
                  {showReclassify && (
                    <ReclassifyButton transactionId={tx.id} />
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
                {formatRp(Number(tx.harga ?? 0))}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-[#34C759]">
                {formatRp(Number(tx.amount ?? 0))}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${TX_STATUS_BADGE[tx.status] ?? ''}`}>
                  {TX_STATUS_LABEL[tx.status] ?? tx.status}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {tx.payment_status ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PAY_STATUS_BADGE[tx.payment_status] ?? 'text-muted-foreground'}`}>
                    {tx.payment_status}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 text-xs">—</span>
                )}
              </td>
              {/* Edit action */}
              <td className="px-3 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <EditTransactionSheet transaction={editTx} />
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
