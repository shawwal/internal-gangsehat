'use client'

import { useEffect, useState } from 'react'
import { syncOpenPaymentLinks } from '@/app/actions/paymentLinks'
import { PayOnlineButton } from './PayOnlineButton'
import { PaymentLinksTable } from './PaymentLinksTable'

/** /finance/payment-links: create + list. Re-checks open links with DOKU on load
 *  as a fallback for missed webhooks. */
export function PaymentLinksWorkspace({ showBranch }: { showBranch: boolean }) {
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    syncOpenPaymentLinks().then((changed) => { if (changed > 0) setReloadKey((k) => k + 1) })
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pembayaran Online</h1>
          <p className="text-sm text-muted-foreground">Link pembayaran DOKU (QRIS / Virtual Account) — status & kwitansi tercatat otomatis</p>
        </div>
        <PayOnlineButton
          label="Buat Link Pembayaran"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 cursor-pointer"
          onChange={() => setReloadKey((k) => k + 1)}
        />
      </div>
      <PaymentLinksTable showBranch={showBranch} reloadKey={reloadKey} />
    </div>
  )
}
