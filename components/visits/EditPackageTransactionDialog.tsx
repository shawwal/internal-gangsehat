'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, X } from 'lucide-react'
import { updateTransaction } from '@/app/actions/transactions'

export interface EditableTransaction {
  id: string
  category: string | null
  harga: number | null
  discount: number | null
  amount: number
  payment_method: string | null
  payment_status: string | null
  penjamin: string | null
  description: string | null
  transaction_date: string
}

interface Props {
  transaction: EditableTransaction
  onClose: () => void
  onSuccess: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n)
}

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function EditPackageTransactionDialog({ transaction, onClose, onSuccess }: Props) {
  const [harga, setHarga]                 = useState(String(transaction.harga ?? 0))
  const [discount, setDiscount]           = useState(String(transaction.discount ?? 0))
  const [amount, setAmount]               = useState(String(transaction.amount))
  const [paymentMethod, setPaymentMethod] = useState(transaction.payment_method ?? 'TUNAI')
  const [paymentStatus, setPaymentStatus] = useState(transaction.payment_status ?? 'DP')
  const [penjamin, setPenjamin]           = useState(transaction.penjamin ?? '')
  const [description, setDescription]     = useState(transaction.description ?? '')
  const [txDate, setTxDate]               = useState(transaction.transaction_date)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  const h = Number(harga) || 0
  const d = Number(discount) || 0
  const a = Number(amount) || 0
  const sisa = Math.max(h - a - d, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const result = await updateTransaction(transaction.id, {
      harga: h,
      discount: d,
      amount: a,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      penjamin:    penjamin    || null,
      description: description || null,
      transaction_date: txDate,
    })
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSuccess(true)
      setTimeout(() => { onSuccess(); onClose() }, 1000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={submitting ? undefined : onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Edit Pembayaran Paket</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <form id="edit-package-tx-form" onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelCls}>Tanggal Transaksi</label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Harga Paket (Rp)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={harga}
                  onChange={(e) => setHarga(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Diskon (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Jumlah Dibayar (Rp)</label>
              <input
                type="number"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Live sisa preview */}
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between transition-colors ${
              sisa > 0
                ? 'bg-destructive/8 border border-destructive/20'
                : 'bg-[#34C759]/8 border border-[#34C759]/20'
            }`}>
              <span className="text-xs text-muted-foreground font-medium">Sisa Tagihan</span>
              <span className={`text-sm font-bold tabular-nums ${sisa > 0 ? 'text-destructive' : 'text-[#34C759]'}`}>
                {fmt(sisa)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Metode Bayar</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                  <option value="TUNAI">TUNAI</option>
                  <option value="TRANSFER BCA">TRANSFER BCA</option>
                  <option value="EDC BCA">EDC BCA</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status Bayar</label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={inputCls}>
                  <option value="LUNAS">LUNAS</option>
                  <option value="DP">DP</option>
                  <option value="PELUNASAN">PELUNASAN</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Penjamin <span className="text-muted-foreground font-normal">(opsional)</span>
              </label>
              <input
                value={penjamin}
                onChange={(e) => setPenjamin(e.target.value)}
                placeholder="Nama penjamin jika ada"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                Keterangan <span className="text-muted-foreground font-normal">(opsional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          {error && (
            <div className="flex items-center gap-1.5 mb-3 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          {success ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <CheckCircle2 size={18} className="text-[#34C759]" />
              <span className="text-sm font-semibold text-[#34C759]">Perubahan disimpan!</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-package-tx-form"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-70 transition-colors"
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
                  : 'Simpan Perubahan'
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
