'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface Props {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}

export function RegionSelect({ options, value, onChange, placeholder = 'Pilih atau ketik...', disabled = false }: Props) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const inputRef            = useRef<HTMLInputElement>(null)
  const containerRef        = useRef<HTMLDivElement>(null)
  const listId              = useId()

  const isInList = options.includes(value)

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commitAndClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [query])

  function commitAndClose() {
    // If user typed something not in the list, keep it as custom value
    if (query.trim()) {
      if (!isInList) onChange(query.trim())
    }
    setQuery('')
    setOpen(false)
  }

  function handleFocus() {
    if (!disabled) {
      setQuery('')
      setOpen(true)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  function handleSelect(opt: string) {
    onChange(opt)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { commitAndClose(); inputRef.current?.blur() }
    if (e.key === 'Enter' && filtered.length > 0) { handleSelect(filtered[0]); e.preventDefault() }
  }

  const displayValue = open ? query : value

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={displayValue}
          onChange={handleInput}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={[
            'w-full pl-3 pr-8 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow',
            disabled
              ? 'border-border/40 text-muted-foreground cursor-not-allowed opacity-60'
              : 'border-border',
            !isInList && value && !open
              ? 'border-secondary/60 text-foreground'
              : '',
          ].join(' ')}
        />
        {value && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label="Hapus pilihan"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown
            size={13}
            className={[
              'absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform duration-200',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        )}
      </div>

      {/* Custom value badge */}
      {!isInList && value && !open && (
        <p className="text-[10px] text-secondary mt-0.5 ml-1">Nilai kustom</p>
      )}

      {/* Dropdown */}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-border bg-background shadow-xl py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              Tidak ditemukan.{query.trim() ? ' Nilai akan disimpan sebagai kustom.' : ''}
            </li>
          ) : (
            filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === opt}
                  onClick={() => handleSelect(opt)}
                  className={[
                    'w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer',
                    value === opt
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-white/8 text-foreground',
                  ].join(' ')}
                >
                  {opt}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
