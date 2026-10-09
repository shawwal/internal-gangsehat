'use client'

import { useState } from 'react'
import { QrCode } from 'lucide-react'
import { PayOnlineFlow } from './PayOnlineFlow'
import type { PaymentLinkTarget, PaymentLinkView } from './types'

interface Props {
  target?: PaymentLinkTarget
  label?: string
  className?: string
  /** Fires on create and on every status change (e.g. paid → refresh host data). */
  onChange?: (link: PaymentLinkView) => void
}

/** Drop-in trigger: create dialog → share/track panel. Embed on any finance surface. */
export function PayOnlineButton({ target, label = 'Bayar Online (QRIS/VA)', className, onChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={className ?? 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors cursor-pointer whitespace-nowrap'}
      >
        <QrCode size={14} /> {label}
      </button>

      {open && <PayOnlineFlow target={target} onClose={() => setOpen(false)} onChange={onChange} />}
    </>
  )
}
