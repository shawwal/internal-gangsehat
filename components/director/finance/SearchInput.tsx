'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

export function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const router     = useRouter()
  const pathname   = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue ?? '')
  const [, startTransition] = useTransition()

  function navigate(q: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set('q', q)
    else params.delete('q')
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(value.trim())
  }

  function handleClear() {
    setValue('')
    navigate('')
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center">
      <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cari pasien, kategori, keterangan…"
        className="pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary w-64 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </form>
  )
}
