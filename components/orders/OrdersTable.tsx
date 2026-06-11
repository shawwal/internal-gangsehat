'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getPatientName, getTrxCode, getPaymentStatus, getTherapistName } from './helpers'
import type { OrderRow } from './types'

interface OrdersTableProps {
  rows: OrderRow[]
  loading: boolean
  total: number
  page: number
  fromIdx: number
  toIdx: number
  totalPages: number
  onPage: (p: number) => void
}

export function OrdersTable({
  rows, loading, total, page, fromIdx, toIdx, totalPages, onPage,
}: OrdersTableProps) {
  const router = useRouter()

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">No</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kode</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pasien</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Layanan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fisio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Jadwal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bayar</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted animate-pulse rounded-lg" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <ClipboardList size={22} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Tidak ada order ditemukan</p>
                    <p className="text-xs text-muted-foreground">Coba ubah filter atau kata kunci pencarian</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const trx     = getTrxCode(row)
                const payment = getPaymentStatus(row)
                const rowTotal = row.discounted_price ?? row.estimated_price ?? 0

                return (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/order/${row.id}`)}
                    className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-muted-foreground text-xs">{fromIdx + i}</td>

                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/order/${row.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline decoration-primary/50 underline-offset-2 transition-colors"
                      >
                        {trx}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground leading-tight">{getPatientName(row)}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-foreground/80 max-w-[140px] truncate text-xs">{row.service_type}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-foreground/70 text-xs truncate max-w-[120px]">{getTherapistName(row)}</p>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-foreground/80">{formatDate(row.scheduled_date)}</p>
                      <p className="text-[10px] text-muted-foreground">{row.scheduled_time}</p>
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge value={row.status} />
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge value={payment} />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-foreground text-xs whitespace-nowrap">
                        {rowTotal > 0 ? formatCurrency(rowTotal) : '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/order/${row.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        aria-label={`Lihat detail order ${trx}`}
                      >
                        <ExternalLink size={12} />
                        Detail
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            Menampilkan {fromIdx}–{toIdx} dari {total.toLocaleString('id-ID')} order
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7
                ? i + 1
                : page <= 4
                ? i + 1
                : page >= totalPages - 3
                ? totalPages - 6 + i
                : page - 3 + i
              return (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    p === page
                      ? 'border-primary bg-primary text-primary-foreground font-medium'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => onPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
