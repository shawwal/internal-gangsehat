'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

interface Props {
  onExport: () => Promise<void>
  label?: string
  disabled?: boolean
}

export function ExportButton({ onExport, label = 'Export Excel', disabled = false }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading || disabled) return
    setLoading(true)
    try {
      await onExport()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm cursor-pointer"
    >
      {loading ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          Mengekspor...
        </>
      ) : (
        <>
          <FileDown size={15} />
          {label}
        </>
      )}
    </button>
  )
}
