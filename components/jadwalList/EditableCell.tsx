'use client'

import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'

interface Option { value: string; label: string }

interface Props {
  value: string
  onSave: (value: string) => Promise<void>
  /** Read-only rendering of the value (defaults to the raw value). */
  display?: ReactNode
  type?: 'text' | 'date' | 'time' | 'select'
  options?: Option[]
  placeholder?: string
}

const inputCls = 'w-full min-w-[7rem] px-2 py-1 border border-primary rounded-lg text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary'

export function EditableCell({ value, onSave, display, type = 'text', options = [], placeholder }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  function start() {
    setDraft(value)
    setEditing(true)
  }

  async function commit(next: string) {
    setEditing(false)
    if (next === value) return
    setSaving(true)
    try { await onSave(next) } finally { setSaving(false) }
  }

  if (editing && type === 'select') {
    return (
      <select
        autoFocus
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setEditing(false)}
        className={inputCls}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft.trim())
          if (e.key === 'Escape') setEditing(false)
        }}
        className={inputCls}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={saving}
      title="Klik untuk mengubah"
      className="group flex items-center gap-1.5 text-left cursor-pointer rounded-lg -mx-1.5 px-1.5 py-0.5 hover:bg-primary/10 disabled:opacity-50"
    >
      <span>{display ?? (value || '—')}</span>
      <Pencil size={11} className="opacity-0 group-hover:opacity-50 shrink-0" />
    </button>
  )
}
