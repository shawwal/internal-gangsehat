'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { ACTIVITY_RESOURCE_TYPES, type ActionFilter, type ResourceTypeFilter } from './types'

const ACTION_TABS: { value: ActionFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'create', label: 'Dibuat' },
  { value: 'update', label: 'Diubah' },
  { value: 'delete', label: 'Dihapus' },
]

export function ActivityLogFilters({
  defaultSearch,
  action,
  resourceType,
}: {
  defaultSearch: string
  action: ActionFilter
  resourceType: ResourceTypeFilter
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultSearch)

  function navigate(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate({ q: value.trim() || undefined })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10">
        {ACTION_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => navigate({ action: tab.value === 'all' ? undefined : tab.value })}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
              action === tab.value
                ? 'bg-primary text-white shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <select
        value={resourceType}
        onChange={(e) => navigate({ resourceType: e.target.value === 'all' ? undefined : e.target.value })}
        className="h-9 px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors"
      >
        <option value="all">Semua Jenis Data</option>
        {Object.entries(ACTIVITY_RESOURCE_TYPES).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Cari nama, email, data…"
          className="pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary w-64 transition-all"
        />
        {value && (
          <button
            type="button"
            onClick={() => { setValue(''); navigate({ q: undefined }) }}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </form>
    </div>
  )
}
