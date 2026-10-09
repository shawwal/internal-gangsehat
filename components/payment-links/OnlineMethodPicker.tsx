'use client'

import { Landmark, QrCode } from 'lucide-react'
import type { PaymentLinkMethod } from '@/lib/doku/channels'

const OPTIONS = [
  { m: 'QRIS' as const, icon: QrCode, title: 'QRIS', sub: 'Scan di klinik / e-wallet' },
  { m: 'VA' as const, icon: Landmark, title: 'Virtual Account', sub: 'Transfer via bank' },
]

/** QRIS / VA cards — shown when a form's Metode Bayar is "PEMBAYARAN ONLINE". */
export function OnlineMethodPicker({ value, onChange, note }: {
  value: PaymentLinkMethod
  onChange: (m: PaymentLinkMethod) => void
  note?: string | null
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map(({ m, icon: Icon, title, sub }) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
            value === m ? 'bg-primary/15 border-primary/50' : 'border-border hover:bg-white/5'
          }`}
        >
          <Icon size={18} className={value === m ? 'text-primary' : 'text-muted-foreground'} />
          <span className={`text-sm font-semibold ${value === m ? 'text-primary' : 'text-foreground'}`}>{title}</span>
          <span className="text-[11px] text-muted-foreground">{sub}</span>
        </button>
      ))}
      {note !== null && (
        <p className="col-span-2 text-[11px] text-muted-foreground">
          {note ?? 'Link DOKU dibuat dari nominal di atas. Pembayaran tercatat otomatis (beserta kwitansi) setelah pasien membayar.'}
        </p>
      )}
    </div>
  )
}
