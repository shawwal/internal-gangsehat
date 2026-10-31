'use client'

import { useState } from 'react'
import { Pagination } from '@/components/leave/Pagination'

const PAGE_SIZE = 6

interface Props<T extends { id: string }> {
  title: string
  items: T[]
  renderItem: (item: T) => React.ReactNode
}

export function PackageSection<T extends { id: string }>({ title, items, renderItem }: Props<T>) {
  const [pageState, setPage] = useState(1)
  // A reload (delete / stop) can shrink the list below the current page.
  const page = Math.min(pageState, Math.max(1, Math.ceil(items.length / PAGE_SIZE)))

  if (items.length === 0) return null
  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {visible.map(renderItem)}
      </div>
      {items.length > PAGE_SIZE && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={items.length} onPage={setPage} />
      )}
    </section>
  )
}
