'use client'

// A <select> replacement with a search box. The list is position: fixed under
// the trigger, so it isn't clipped inside scrolling tables / modals.
// Keyboard: ↑ ↓ to move, Enter to pick, Esc to close.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface SearchSelectOption {
  value: string
  label: string
  /** small grey text on the right, e.g. "saran" / "nonaktif" */
  hint?: string
}

interface Props {
  options: SearchSelectOption[] | null   // null = loading
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  /** when set, an extra first option that clears the value */
  emptyOptionLabel?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

const TRIGGER = 'w-full flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm bg-input text-left focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60'

export function SearchSelect({
  options, value, onChange, placeholder = 'Pilih…', searchPlaceholder = 'Cari…',
  emptyOptionLabel, disabled, className, ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options?.find((o) => o.value === value)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hits = (options ?? []).filter((o) => !q || o.label.toLowerCase().includes(q))
    return emptyOptionLabel && !q ? [{ value: '', label: emptyOptionLabel }, ...hits] : hits
  }, [options, query, emptyOptionLabel])

  function place() {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const up = window.innerHeight - r.bottom < 300 && r.top > 300
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: Math.min(r.left, window.innerWidth - 288 - 8), width: Math.max(r.width, 224), up })
  }

  function openPanel() {
    if (disabled) return
    place()
    setQuery('')
    setActive(Math.max(0, list.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    // preventScroll: focusing must not scroll a modal, which would close the panel.
    inputRef.current?.focus({ preventScroll: true })
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false)
    }
    // Any scroll outside the list (page, table) would detach the panel — close it.
    const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) setOpen(false) }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  function pick(v: string) {
    setOpen(false)
    triggerRef.current?.focus()
    if (v !== value) onChange(v)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, list.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[active]) pick(list[active].value) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus() }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || options === null}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { e.preventDefault(); openPanel() } }}
        className={className ?? TRIGGER}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={`truncate flex-1 ${selected ? '' : 'text-muted-foreground'}`}>
          {options === null ? 'Memuat…' : selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: pos.left, width: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          className="z-[100] max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden"
        >
          <div className="relative border-b border-border">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-2.5 text-sm bg-transparent focus:outline-none"
              aria-label={searchPlaceholder}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {list.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">Tidak ada hasil &ldquo;{query}&rdquo;</li>
            ) : list.map((o, i) => (
              <li key={o.value || '__empty'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${i === active ? 'bg-muted' : ''}`}
                >
                  <Check size={13} className={o.value === value ? 'text-primary shrink-0' : 'opacity-0 shrink-0'} />
                  <span className={`truncate ${o.value ? '' : 'text-muted-foreground'}`}>{o.label}</span>
                  {o.hint && <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  )
}
