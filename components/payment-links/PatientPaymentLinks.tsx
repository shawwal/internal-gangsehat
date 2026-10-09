'use client'

import { useState } from 'react'
import { QrCode } from 'lucide-react'
import { PayOnlineButton } from './PayOnlineButton'
import { PaymentLinksTable } from './PaymentLinksTable'

/** Patient detail: this patient's DOKU payment links + create. */
export function PatientPaymentLinks({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [reloadKey, setReloadKey] = useState(0)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QrCode size={15} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Pembayaran Online</span>
        </div>
        <PayOnlineButton
          label="Buat link"
          target={{ patientId, patientName }}
          onChange={() => setReloadKey((k) => k + 1)}
        />
      </div>
      <PaymentLinksTable scope={{ patientId }} showFilters={false} reloadKey={reloadKey} />
    </div>
  )
}
