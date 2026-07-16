'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, Search, Stethoscope, X } from 'lucide-react'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

interface Props {
  branchId: string | null
  selected: LayananRow | null
  onSelect: (layanan: LayananRow | null) => void
}

// Searchable combobox for picking a specific SESI KLINIK service (e.g. "Sport
// Massage") when a "Satu Sesi" visit has no package to fall back on. Mirrors
// the dropdown/outside-click mechanics of components/ui/RegionSelect.tsx, but
// — unlike RegionSelect — never accepts a freeform custom value, since the
// selection must map to a real internal_layanan row to drive billing.
export function LayananSearchPicker({ branchId, selected, onSelect }: Props) {
  const [rows, setRows]       = useState<LayananRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!branchId) { setRows([]); return }
    setLoading(true)
    fetchLayananByBranch(branchId).then((data) => {
      setRows(data.filter((r) => r.kategori === 'SESI KLINIK' && r.is_active))
      setLoading(false)
    })
  }, [branchId])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.nama.toLowerCase().includes(q))
  }, [rows, query])

  function handleOpen() {
    if (!branchId) return
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSelect(row: LayananRow) {
    onSelect(row)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onSelect(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
    if (e.key === 'Enter' && filtered.length > 0) { handleSelect(filtered[0]); e.preventDefault() }
  }

  if (!branchId) {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">Terapis tidak memiliki branch. Hubungi HR.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-foreground mb-1.5">
        Jenis Layanan <span className="font-normal text-muted-foreground">(opsional)</span>
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        role="combobox"
        aria-expanded={open}
        className={[
          'w-full flex items-center gap-2 pl-3 pr-2.5 py-2.5 rounded-xl border bg-background text-sm text-left transition-shadow cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-primary/40',
          loading ? 'opacity-60 cursor-not-allowed' : '',
          open ? 'border-primary' : 'border-border',
        ].join(' ')}
      >
        <Stethoscope size={13} className="text-muted-foreground shrink-0" />
        {selected ? (
          <span className="flex-1 min-w-0 flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{selected.nama}</span>
            <span className="text-xs text-muted-foreground shrink-0">Rp {fmt(selected.harga)}</span>
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">
            {loading ? 'Memuat layanan...' : 'Pilih jenis layanan...'}
          </span>
        )}
        {selected ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleClear}
            className="p-0.5 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Hapus pilihan"
          >
            <X size={13} />
          </span>
        ) : (
          <ChevronDown
            size={13}
            className={`text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-background shadow-xl overflow-hidden">
          <div className="relative p-2 border-b border-border/40">
            <Search size={12} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cari layanan..."
              className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground text-center">
                {rows.length === 0
                  ? 'Belum ada layanan Sesi Klinik untuk cabang ini.'
                  : 'Layanan tidak ditemukan.'}
              </li>
            ) : (
              filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected?.id === row.id}
                    onClick={() => handleSelect(row)}
                    className={[
                      'w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors cursor-pointer',
                      selected?.id === row.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-white/8 text-foreground',
                    ].join(' ')}
                  >
                    <span className="text-sm font-medium truncate">{row.nama}</span>
                    <span className="text-xs text-muted-foreground shrink-0">Rp {fmt(row.harga)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
