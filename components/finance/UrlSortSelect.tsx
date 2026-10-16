'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

interface Props {
  value: string
  options: { value: string; label: string }[]
  /** Search param key (default `sort`). */
  param?: string
}

/** Sort dropdown backed by a search param; resets pagination on change. */
export function UrlSortSelect({ value, options, param = 'sort' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(param, next)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative flex items-center">
      <ArrowUpDown size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
      <select
        aria-label="Urutkan"
        value={value}
        onChange={(e) => navigate(e.target.value)}
        className="h-9 pl-8 pr-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
