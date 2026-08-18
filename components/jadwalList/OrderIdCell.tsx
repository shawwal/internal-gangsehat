'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchBookingIdByKode } from '@/app/actions/orders'

export function OrderIdCell({ orderId }: { orderId: string | null }) {
  const [resolving, setResolving] = useState(false)

  if (!orderId) return <span className="text-muted-foreground">—</span>

  async function handleOpen() {
    setResolving(true)
    const bookingId = await fetchBookingIdByKode(orderId!)
    setResolving(false)
    if (!bookingId) { alert('Order tidak ditemukan untuk kode ini.'); return }
    window.open(`/order/${bookingId}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={handleOpen}
      disabled={resolving}
      className="flex items-center gap-1.5 font-mono text-xs text-primary hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-wait"
    >
      {resolving && <Loader2 size={11} className="animate-spin" />}
      {orderId}
    </button>
  )
}
