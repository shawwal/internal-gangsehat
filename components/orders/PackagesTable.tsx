'use client'

import Link from 'next/link'
import { ExternalLink, Package, MessageCircle } from 'lucide-react'
import { StatusBadge } from '@/components/internal/StatusBadge'
import { formatDate } from '@/lib/utils'
import { daysColor } from './types'
import type { PackageOrderRow } from './types'

interface PackagesTableProps {
  rows: PackageOrderRow[]
  loading: boolean
  total: number
  page: number
  totalPages: number
  fromIdx: number
  toIdx: number
  onPage: (p: number) => void
}

const COLS = 10

export function PackagesTable({
  rows, loading, total, page, totalPages, fromIdx, toIdx, onPage,
}: PackagesTableProps) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {[
                'No', 'Kode', 'Pasien', 'Layanan', 'Status',
                'Total Pertemuan', 'Pertemuan Terakhir', 'Pertemuan Selanjutnya',
                'Jarak Hari', 'Aksi',
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: COLS }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted animate-pulse rounded-lg" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLS} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Package size={22} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Tidak ada paket aktif</p>
                    <p className="text-xs text-muted-foreground">Paket yang sedang berjalan akan muncul di sini</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 hover:bg-primary/5 transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fromIdx + i}</td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/order/${row.id}`}
                      className="font-mono text-xs font-medium text-primary hover:underline decoration-primary/50 underline-offset-2 transition-colors"
                    >
                      {row.kode_transaksi}
                    </Link>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground leading-tight">{row.patient_name}</p>
                    {row.patient_phone && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{row.patient_phone}</p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-xs text-foreground/80 whitespace-nowrap">{row.service_type}</p>
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge value={row.status} />
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary text-sm font-bold">
                      {row.total_sessions}x
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {row.last_hadir_date ? (
                      <p className="text-xs text-foreground/80 whitespace-nowrap">
                        {formatDate(row.last_hadir_date)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {row.next_session_date ? (
                      <p className="text-xs text-foreground/80 whitespace-nowrap">
                        {formatDate(row.next_session_date)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {row.days_since_last !== null ? (
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-xl text-xs font-semibold transition-colors duration-200 ${daysColor(row.days_since_last)}`}
                      >
                        {row.days_since_last} hari
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {row.patient_phone && (
                        <a
                          href={`https://wa.me/${row.patient_phone.replace(/\D/g, '').replace(/^0/, '62')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp pasien"
                          className="p-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors active:scale-95"
                        >
                          <MessageCircle size={13} />
                        </a>
                      )}
                      <Link
                        href={`/order/${row.id}`}
                        title="Lihat detail"
                        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-95"
                      >
                        <ExternalLink size={13} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            Menampilkan {fromIdx}–{toIdx} dari {total.toLocaleString('id-ID')} paket
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
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
                  className={`px-2.5 py-1.5 rounded-lg border transition-colors ${
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
              className="px-2.5 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
