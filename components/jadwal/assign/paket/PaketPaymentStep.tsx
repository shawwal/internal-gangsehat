'use client'

import { useState } from 'react'
import { CreditCard, X } from 'lucide-react'
import { createTransactionManual } from '@/app/actions/transactions'

export interface PaketPaymentStepProps {
  patientId: string
  patientName: string
  packageId: string | null
  packageName: string
  jumlahSesi: number
  hargaDefault: number
  category: 'PAKET KLINIK' | 'PAKET VISIT'
  branchId: string | null
  onDone: () => void
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function PaketPaymentStep({
  patientId,
  patientName,
  packageId,
  packageName,
  jumlahSesi,
  hargaDefault,
  category,
  branchId,
  onDone,
}: PaketPaymentStepProps) {
  const [harga, setHarga]   = useState(hargaDefault > 0 ? String(hargaDefault) : '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'TUNAI' | 'TRANSFER BCA' | 'EDC BCA' | 'TRANSFER BANK KALBAR'>('TUNAI')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const hargaNum  = parseFloat(harga.replace(/\D/g, '')) || 0
  const amountNum = parseFloat(amount.replace(/\D/g, '')) || 0
  const sisa      = Math.max(hargaNum - amountNum, 0)
  const payStatus = sisa === 0 ? 'LUNAS' : 'DP'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!harga || !amount) { setError('Isi harga dan jumlah bayar.'); return }
    setSaving(true)
    setError(null)

    const { error: txErr } = await createTransactionManual({
      type:             'income',
      category,
      harga:            hargaNum,
      amount:           amountNum,
      discount:         0,
      payment_method:   method,
      payment_status:   payStatus,
      penjamin:         null,
      description:      `${packageName} — ${jumlahSesi} sesi`,
      transaction_date: new Date().toISOString().slice(0, 10),
      visit_id:         null,
      patient_id:       patientId,
      package_id:       packageId,
      branch_id:        branchId,
    })

    setSaving(false)
    if (txErr) {
      setError(`Gagal mencatat pembayaran: ${txErr}`)
      return
    }

    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-4" onClick={onDone}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Catat Pembayaran Paket</p>
              <p className="text-xs text-muted-foreground">{patientName}</p>
            </div>
          </div>
          <button onClick={onDone} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Paket info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl">
            <span className="text-xs text-muted-foreground">Paket:</span>
            <span className="text-xs font-medium text-foreground">{packageName} · {jumlahSesi} sesi</span>
          </div>

          {/* Harga & Bayar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Harga Paket (Rp)</label>
              <input
                required
                type="number"
                min="0"
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>Jumlah Bayar (Rp)</label>
              <input
                required
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </div>
          </div>

          {/* Sisa */}
          {(hargaNum > 0 || amountNum > 0) && (
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium ${
              sisa === 0 ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#FFB35C]/10 text-[#FFB35C]'
            }`}>
              <span>{sisa === 0 ? 'Lunas' : 'Sisa tagihan'}</span>
              <span>{sisa === 0 ? '✓' : `Rp ${sisa.toLocaleString('id-ID')}`}</span>
            </div>
          )}

          {/* Metode bayar */}
          <div>
            <label className={labelCls}>Metode Pembayaran</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inputCls}>
              <option value="TUNAI">TUNAI</option>
              <option value="TRANSFER BCA">TRANSFER BCA</option>
              <option value="EDC BCA">EDC BCA</option>
              <option value="TRANSFER BANK KALBAR">TRANSFER BANK KALBAR</option>
            </select>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onDone}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Lewati
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Catat Pembayaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
