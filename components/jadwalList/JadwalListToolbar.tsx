'use client'

import { PAGE_SIZE_OPTIONS } from './types'

interface Props {
  pageSize: number
  onPageSizeChange: (n: number) => void
}

export function JadwalListToolbar({ pageSize, onPageSizeChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="px-2.5 py-1.5 border border-border rounded-xl bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span>data</span>
    </div>
  )
}
