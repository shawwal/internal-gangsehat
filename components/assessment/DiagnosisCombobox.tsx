'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  value: string
  onChange: (v: string) => void
  options: string[]
  onOptionAdded: (name: string) => void
  placeholder?: string
  disabled?: boolean
}

export function DiagnosisCombobox({ value, onChange, options, onOptionAdded, placeholder = 'Cari atau ketik diagnosa...', disabled = false }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const isInList = options.some((o) => o.toLowerCase() === value.toLowerCase())

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const exactMatch = filtered.some((o) => o.toLowerCase() === query.trim().toLowerCase())
  const canAddNew = query.trim().length > 0 && !exactMatch

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setQuery('')
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleFocus() {
    if (!disabled) {
      setQuery('')
      setOpen(true)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
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

  async function handleAddNew() {
    const name = query.trim()
    if (!name || saving) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('diagnoses').insert({ name })
    setSaving(false)
    if (error && error.code !== '23505') {
      return
    }
    onOptionAdded(name)
    handleSelect(name)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setQuery(''); setOpen(false); inputRef.current?.blur() }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) handleSelect(filtered[0])
      else if (canAddNew) handleAddNew()
    }
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
            'w-full pl-3 pr-8 py-2 border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-shadow',
            disabled
              ? 'border-border/40 text-muted-foreground cursor-not-allowed opacity-60'
              : 'border-border',
            !isInList && value && !open ? 'border-secondary/60' : '',
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

      {!isInList && value && !open && (
        <p className="text-[10px] text-secondary mt-0.5 ml-1">Diagnosa kustom</p>
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-border bg-background shadow-xl py-1"
        >
          {filtered.map((opt) => (
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
          ))}
          {filtered.length === 0 && !canAddNew && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Tidak ditemukan.</li>
          )}
          {canAddNew && (
            <li className="border-t border-border">
              <button
                type="button"
                onClick={handleAddNew}
                disabled={saving}
                className="w-full flex items-center gap-1.5 text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Plus size={13} />
                {saving ? 'Menyimpan...' : `Gunakan "${query.trim()}" sebagai diagnosa baru`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
