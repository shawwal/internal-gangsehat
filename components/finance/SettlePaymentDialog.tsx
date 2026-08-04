'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import { updateTransaction } from '@/app/actions/transactions'
import { formatCurrency } from '@/lib/utils'

const PAYMENT_METHODS = ['TUNAI', 'TRANSFER BCA', 'EDC BCA']

export interface SettleTransaction {
  id: string
  patient_name: string | null
  category: string
  harga: number
  discount: number
  amount: number
  payment_method: string | null
  visitLabel: string | null
}

interface Props {
  transaction: SettleTransaction
  onClose: () => void
}

export function SettlePaymentDialog({ transaction, onClose }: Props) {
  const router = useRouter()
  const sisaNow = Math.max(transaction.harga - transaction.amount - transaction.discount, 0)

  const [extra, setExtra]     = useState(String(sisaNow))
  const [method, setMethod]   = useState(transaction.payment_method ?? 'TUNAI')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const extraNum   = Number(extra) || 0
  const newAmount  = transaction.amount + extraNum
  const sisaAfter  = Math.max(transaction.harga - newAmount - transaction.discount, 0)
  const newStatus  = sisaAfter <= 0 ? 'LUNAS' : 'PELUNASAN'

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const result = await updateTransaction(transaction.id, {
      amount:         newAmount,
      payment_status: newStatus,
      payment_method: method,
    })
    if (result.error) {
      setSubmitting(false)
      setError(result.error)
      return
    }
    setSuccess(true)
    setTimeout(() => { onClose(); router.refresh() }, 900)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Wallet size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{transaction.patient_name ?? 'Pasien'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {transaction.category}{transaction.visitLabel ? ` · ${transaction.visitLabel}` : ''}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Current state */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Harga</p>
              <p className="text-xs font-semibold text-foreground">{formatCurrency(transaction.harga)}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Dibayar</p>
              <p className="text-xs font-semibold text-[#34C759]">{formatCurrency(transaction.amount)}</p>
            </div>
            <div className="rounded-xl bg-[#FFB35C]/10 border border-[#FFB35C]/30 px-2 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Sisa</p>
              <p className="text-xs font-semibold text-[#FFB35C]">{formatCurrency(sisaNow)}</p>
            </div>
          </div>

          {/* Additional payment */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Pembayaran Tambahan (Rp)</label>
            <input
              type="number"
              min="0"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Metode Bayar</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    method === m
                      ? 'bg-primary/20 border-primary/50 text-primary'
                      : 'border-border text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
            sisaAfter > 0 ? 'bg-destructive/8 border border-destructive/20' : 'bg-[#34C759]/8 border border-[#34C759]/20'
          }`}>
            <span className="text-xs text-muted-foreground font-medium">Sisa Setelah Ini</span>
            <span className={`text-sm font-bold ${sisaAfter > 0 ? 'text-destructive' : 'text-[#34C759]'}`}>
              {formatCurrency(sisaAfter)} · {newStatus}
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center justify-center gap-2 py-1">
              <CheckCircle2 size={16} className="text-[#34C759]" />
              <span className="text-sm font-semibold text-[#34C759]">Pembayaran tersimpan!</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || success || extraNum <= 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-70 transition-colors cursor-pointer"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
              : 'Simpan Pembayaran'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
