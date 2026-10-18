'use client'

import { useState } from 'react'
import { Gift, Minus, Plus } from 'lucide-react'
import { redeemReward, type RewardBalanceRow, type RewardItem } from '@/app/actions/rewards'
import { ModalShell, inputCls } from './ui'

interface Props {
  patient: RewardBalanceRow
  item: RewardItem
  onClose: () => void
  onRedeemed: (text: string) => void
}

export function RedeemConfirmDialog({ patient, item, onClose, onRedeemed }: Props) {
  const maxQty = Math.max(1, Math.min(
    Math.floor(patient.balance / item.pointsCost),
    item.stock ?? Number.POSITIVE_INFINITY,
    99,
  ))
  const [qty, setQty]       = useState(1)
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const total = item.pointsCost * qty
  const remaining = patient.balance - total

  async function confirm() {
    setSaving(true)
    setError(null)
    const res = await redeemReward({ patientId: patient.patientId, itemId: item.id, quantity: qty, note })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onRedeemed(`${item.name}${qty > 1 ? ` ×${qty}` : ''} ditukar untuk ${patient.name} (−${total} poin).`)
  }

  return (
    <ModalShell
      onClose={onClose}
      maxWidth="max-w-md"
      icon={<Gift size={16} className="text-primary" />}
      title="Konfirmasi Penukaran"
      subtitle={`${patient.name}${patient.noRm ? ` · RM ${patient.noRm}` : ''}`}
      footer={
        <div className="space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
            >
              Batal
            </button>
            <button
              onClick={confirm}
              disabled={saving || remaining < 0}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Memproses...' : `Tukar ${total} poin`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.pointsCost} poin / item</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              disabled={qty <= 1 || saving}
              className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              aria-label="Kurangi"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
            <button
              onClick={() => setQty(q => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty || saving}
              className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              aria-label="Tambah"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <dl className="rounded-xl bg-muted/50 p-3 text-sm space-y-1.5">
          <div className="flex justify-between"><dt className="text-muted-foreground">Saldo sekarang</dt><dd className="tabular-nums">{patient.balance} poin</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Total penukaran</dt><dd className="tabular-nums text-destructive">−{total} poin</dd></div>
          <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><dt>Sisa saldo</dt><dd className="tabular-nums">{remaining} poin</dd></div>
        </dl>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">Catatan</span>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Opsional, mis. diambil di cabang" className={inputCls} />
        </label>
      </div>
    </ModalShell>
  )
}
