import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function buildUrl(baseParams: Record<string, string>, page: number) {
  const p = new URLSearchParams(baseParams)
  if (page > 1) p.set('page', String(page))
  else p.delete('page')
  const qs = p.toString()
  return `/activity-log${qs ? `?${qs}` : ''}`
}

export function ActivityLogPagination({
  baseParams,
  page,
  totalPages,
  totalCount,
}: {
  baseParams: Record<string, string>
  page: number
  totalPages: number
  totalCount: number
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
      <p className="text-xs text-muted-foreground">
        Halaman {page} dari {totalPages} · {totalCount} aktivitas
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={buildUrl(baseParams, page - 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors">
            <ChevronLeft size={13} /> Sebelumnya
          </Link>
        ) : (
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-muted-foreground/40 cursor-not-allowed">
            <ChevronLeft size={13} /> Sebelumnya
          </span>
        )}
        <span className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium bg-primary text-primary-foreground mx-1">
          {page}
        </span>
        {page < totalPages ? (
          <Link href={buildUrl(baseParams, page + 1)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/8 transition-colors">
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
