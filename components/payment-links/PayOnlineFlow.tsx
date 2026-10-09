'use client'

import { useState } from 'react'
import { CreatePaymentLinkDialog } from './CreatePaymentLinkDialog'
import { PaymentLinkPanel } from './PaymentLinkPanel'
import type { PaymentLinkTarget, PaymentLinkView } from './types'

interface Props {
  target?: PaymentLinkTarget
  onClose: () => void
  /** Fires on create and on every real status change (e.g. paid → refresh host data). */
  onChange?: (link: PaymentLinkView) => void
}

/** Create dialog → share/track panel, mounted by any host that controls when it opens. */
export function PayOnlineFlow({ target, onClose, onChange }: Props) {
  const [link, setLink] = useState<PaymentLinkView | null>(null)

  if (link) return <PaymentLinkPanel link={link} onClose={onClose} onChange={onChange} />
  return (
    <CreatePaymentLinkDialog
      target={target}
      onClose={onClose}
      onCreated={(l) => { setLink(l); onChange?.(l) }}
    />
  )
}
