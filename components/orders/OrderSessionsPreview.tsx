'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { OrderSessionPreviewRow } from '@/app/actions/orders'

interface Props {
  orderId: string
  loading: boolean
  error: string | null
  sessions: OrderSessionPreviewRow[]
  canSeePricing: boolean
}

// Read-only inline session breakdown for an expanded orders-list row — no edit
// affordances here (view-only by design); "Lihat Detail" links to /order/[id],
// which already has the full edit machinery (SessionsTable.tsx), gated the
// same way it always has been.
export function OrderSessionsPreview({ orderId, loading, error, sessions, canSeePricing }: Props) {
  if (loading) {
    return (
      <div className="space-y-2 py-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-destructive py-2">{error}</p>
  }

  if (sessions.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Belum ada sesi tercatat untuk order ini.</p>
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Pertemuan</th>
              <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Tanggal</th>
              <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Jam</th>
              <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Fisio</th>
              <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              {canSeePricing && (
                <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-right whitespace-nowrap">Nominal Bayar</th>
              )}
              <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Keterangan</th>
              <th className="px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-center">Opsi</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">Ke-{s.session_number}</td>
                <td className="px-3 py-2 text-foreground/80 whitespace-nowrap">{s.tanggal ? formatDate(s.tanggal) : '—'}</td>
                <td className="px-3 py-2 text-foreground/80 whitespace-nowrap">{s.jam?.slice(0, 5) ?? '—'}</td>
                <td className="px-3 py-2 text-foreground/80">{s.therapist_name}</td>
                <td className="px-3 py-2"><StatusBadge value={s.status} /></td>
                {canSeePricing && (
                  <td className="px-3 py-2 text-right text-foreground/80 whitespace-nowrap">
                    {s.nominal_bayar ? formatCurrency(s.nominal_bayar) : '—'}
                  </td>
                )}
                <td className="px-3 py-2 text-foreground/70 max-w-[160px] truncate">{s.keterangan ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  <Link
                    href={`/order/${orderId}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                  >
                    <ExternalLink size={11} /> Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
