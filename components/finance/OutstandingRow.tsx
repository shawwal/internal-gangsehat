'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { EditTransactionSheet, type TransactionForEdit } from '@/components/director/finance/EditTransactionSheet'
import { SettlePaymentDialog } from './SettlePaymentDialog'

const PAY_STATUS_BADGE: Record<string, string> = {
  DP:        'bg-yellow-500/15 text-yellow-400',
  PELUNASAN: 'bg-primary/15 text-primary',
  LUNAS:     'bg-green-500/15 text-green-400',
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n)
}

export interface OutstandingTxRow {
  id: string
  transaction_date: string
  patient_id: string | null
  patient_name: string | null
  category: string
  branch_name: string
  harga: number | null
  discount: number | null
  amount: number | null
  outstanding: number | null
  payment_method: string | null
  payment_status: string | null
  visitLabel: string | null
}

interface Props {
  tx: OutstandingTxRow
  showBranchColumn: boolean
  editTx: TransactionForEdit
}

export function OutstandingRow({ tx, showBranchColumn, editTx }: Props) {
  const [settling, setSettling] = useState(false)
  const isSettled = Number(tx.outstanding ?? 0) <= 0

  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
        onClick={() => setSettling(true)}
      >
        <td className="px-5 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
          {new Date(tx.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </td>
        <td className="px-4 py-3 text-xs text-foreground/90">
          {tx.patient_name ?? <span className="text-muted-foreground/40">—</span>}
        </td>
        <td className="px-4 py-3 text-xs font-medium text-foreground">{tx.category}</td>
        {showBranchColumn && (
          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{tx.branch_name}</td>
        )}
        <td className="px-4 py-3 text-xs">
          {tx.visitLabel && tx.patient_id ? (
            <Link
              href={`/patients/${tx.patient_id}/visits`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary hover:underline whitespace-nowrap"
            >
              {tx.visitLabel}
            </Link>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs text-foreground">{formatRp(Number(tx.harga ?? 0))}</td>
        <td className="px-4 py-3 text-right font-mono text-xs text-[#34C759]">{formatRp(Number(tx.amount ?? 0))}</td>
        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#FFB35C]">{formatRp(Number(tx.outstanding ?? 0))}</td>
        <td className="px-4 py-3 text-center">
          {tx.payment_status ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PAY_STATUS_BADGE[tx.payment_status] ?? 'text-muted-foreground'}`}>
              {tx.payment_status}
            </span>
          ) : (
            <span className="text-muted-foreground/40 text-xs">—</span>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-1">
            {!isSettled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSettling(true) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Wallet size={12} />
                Lanjutkan Bayar
              </button>
            )}
            <div onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <EditTransactionSheet transaction={editTx} />
            </div>
          </div>
        </td>
      </tr>

      {settling && (
        <SettlePaymentDialog
          transaction={{
            id:             tx.id,
            patient_name:   tx.patient_name,
            category:       tx.category,
            harga:          Number(tx.harga ?? 0),
            discount:       Number(tx.discount ?? 0),
            amount:         Number(tx.amount ?? 0),
            payment_method: tx.payment_method,
            visitLabel:     tx.visitLabel,
          }}
          onClose={() => setSettling(false)}
        />
      )}
    </>
  )
}
