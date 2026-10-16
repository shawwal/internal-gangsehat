'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Check, ChevronDown, Search, UserRound, X } from 'lucide-react'
import { SERVICE_CATEGORIES } from '@/lib/finance/attribution'

export interface TherapistOption {
  id: string
  name: string
  inactive: boolean
}

const CONTROL = 'h-9 px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors'

/** Dropdown with a search box for picking one therapist. `null` options = still loading. */
export function TherapistCombobox({
  options, value, onChange,
}: {
  options: TherapistOption[] | null
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const rootRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options?.find((o) => o.id === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (options ?? []).filter((o) => !q || o.name.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  function pick(id: string) {
    setOpen(false)
    setQuery('')
    if (id !== value) onChange(id)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${CONTROL} flex items-center gap-2 min-w-44 max-w-60 cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <UserRound size={14} className="text-muted-foreground shrink-0" />
        <span className={`truncate flex-1 text-left ${selected ? '' : 'text-muted-foreground'}`}>
          {selected?.name ?? (value && options === null ? 'Memuat…' : 'Semua Terapis')}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Hapus filter terapis"
            onClick={(e) => { e.stopPropagation(); pick('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); pick('') } }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </span>
        ) : (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden">
          <div className="relative border-b border-border">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && filtered.length === 1) pick(filtered[0].id) }}
              placeholder="Cari nama terapis…"
              className="w-full pl-8 pr-3 py-2.5 text-sm bg-transparent focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {!query && (
              <li>
                <button type="button" onClick={() => pick('')} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left">
                  <Check size={13} className={value ? 'opacity-0' : 'text-primary'} /> Semua Terapis
                </button>
              </li>
            )}
            {options === null ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">Memuat daftar terapis…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">Tidak ada terapis &ldquo;{query}&rdquo;</li>
            ) : filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onClick={() => pick(o.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                >
                  <Check size={13} className={o.id === value ? 'text-primary shrink-0' : 'opacity-0 shrink-0'} />
                  <span className={`truncate ${o.inactive ? 'text-muted-foreground' : ''}`}>{o.name}</span>
                  {o.inactive && <span className="ml-auto text-[10px] text-muted-foreground shrink-0">nonaktif</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface Props {
  therapists: TherapistOption[] | null
  therapist: string
  category: string
  onChange: (next: { therapist: string; category: string }) => void
}

/** Therapist (searchable dropdown) + service category dropdown. */
export function TherapistServiceFilters({ therapists, therapist, category, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TherapistCombobox options={therapists} value={therapist} onChange={(id) => onChange({ therapist: id, category })} />
      <select
        aria-label="Layanan"
        value={category}
        onChange={(e) => onChange({ therapist, category: e.target.value })}
        className={`${CONTROL} cursor-pointer`}
      >
        <option value="">Semua Layanan</option>
        {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
}

/** Same, backed by `?therapist=&category=` (server-rendered pages). */
export function UrlTherapistServiceFilters({ therapists, therapist, category }: Omit<Props, 'onChange'>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(next: { therapist: string; category: string }) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.therapist) params.set('therapist', next.therapist)
    else params.delete('therapist')
    if (next.category) params.set('category', next.category)
    else params.delete('category')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return <TherapistServiceFilters therapists={therapists} therapist={therapist} category={category} onChange={navigate} />
}
