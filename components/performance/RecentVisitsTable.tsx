'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { VisitRow } from './types'
import { formatDateShort } from './utils'

const SERVICE_BADGE: Record<string, string> = {
  'TERAPI AWAL':  'bg-primary/15 text-primary',
  'PAKET TERAPI': 'bg-chart-4/15 text-chart-4',
  'SESI TERAPI':  'bg-secondary/15 text-secondary',
  'TA VISIT':     'bg-primary/10 text-primary',
  'PAKET VISIT':  'bg-chart-4/10 text-chart-4',
  'SESI VISIT':   'bg-secondary/10 text-secondary',
  'LAINNYA':      'bg-muted text-muted-foreground',
}

const PAGE_SIZE = 10

interface RecentVisitsTableProps {
  visits: VisitRow[]
}

export function RecentVisitsTable({ visits }: RecentVisitsTableProps) {
  const [page, setPage] = useState(0)
  const total = visits.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const paged = visits.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-5 pb-3 border-b border-border/40">
        <h2 className="text-sm font-semibold text-foreground">Kunjungan Terbaru</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {total.toLocaleString('id-ID')} kunjungan dalam periode ini
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              {['No.', 'Fisio', 'No. RM', 'Layanan', 'Tanggal'].map(h => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((v, i) => {
              const idx = page * PAGE_SIZE + i + 1
              const fisio   = (v.internal_profiles as any)?.full_name ?? '—'
              const noRm    = (v.patients as any)?.no_rm ?? '—'
              const svcType = v.service_type ?? 'LAINNYA'
              const badge   = SERVICE_BADGE[svcType] ?? 'bg-muted text-muted-foreground'
              const date    = v.visit_date ? formatDateShort(v.visit_date) : '—'

              return (
                <tr
                  key={v.id}
                  className="border-b border-border/25 hover:bg-muted/20 transition-colors duration-150"
                >
                  <td className="px-4 py-2.5 text-xs text-muted-foreground w-10">{idx}</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-foreground">{fisio}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{noRm}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
                      {svcType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{date}</td>
                </tr>
              )
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Belum ada kunjungan pada periode ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
