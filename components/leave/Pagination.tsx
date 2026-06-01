'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-xs text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground">{from}–{to}</span> dari{' '}
        <span className="font-medium text-foreground">{total}</span> data
      </p>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="p-2 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="text-sm font-medium px-3 py-1.5 rounded-xl bg-muted text-foreground min-w-[5rem] text-center">
          {page} / {totalPages}
        </span>

        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="p-2 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
