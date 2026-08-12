import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildFinanceUrl } from './types'

interface Props {
  page: number
  totalPages: number
  total: number
  baseParams: Record<string, string>
}

export function TransactionsPagination({ page, totalPages, total, baseParams }: Props) {
  if (totalPages <= 1) return null

  const hrefFor = (p: number) => buildFinanceUrl(baseParams, { page: String(p) })

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
      <p className="text-xs text-muted-foreground">
        Halaman {page} dari {totalPages} · {total} transaksi
      </p>
      <div className="flex items-center gap-1">
        {/* Prev */}
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors"
          >
            <ChevronLeft size={13} /> Sebelumnya
          </Link>
        ) : (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-muted-foreground/40 cursor-not-allowed">
            <ChevronLeft size={13} /> Sebelumnya
          </span>
        )}

        {/* Page numbers */}
        <div className="flex items-center gap-0.5 mx-1">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number
            if (totalPages <= 7) {
              pageNum = i + 1
            } else if (page <= 4) {
              pageNum = i < 6 ? i + 1 : totalPages
            } else if (page >= totalPages - 3) {
              pageNum = i === 0 ? 1 : totalPages - 6 + i
            } else {
              pageNum = i === 0 ? 1 : i === 6 ? totalPages : page - 3 + i
            }
            const isEllipsis =
              totalPages > 7 &&
              ((i === 1 && pageNum !== 2) || (i === 5 && pageNum !== totalPages - 1))
            if (isEllipsis) {
              return <span key={i} className="px-1 text-xs text-muted-foreground/50">…</span>
            }
            return (
              <Link
                key={i}
                href={hrefFor(pageNum)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  pageNum === page
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-white/8 text-foreground/70'
                }`}
              >
                {pageNum}
              </Link>
            )
          })}
        </div>

        {/* Next */}
        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors"
          >
            Berikutnya <ChevronRight size={13} />
          </Link>
        ) : (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-muted-foreground/40 cursor-not-allowed">
            Berikutnya <ChevronRight size={13} />
          </span>
        )}
      </div>
    </div>
  )
}
