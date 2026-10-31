'use client'

import { useState, useRef, useEffect } from 'react'
import { FileDown, ChevronDown, FileText, Sheet } from 'lucide-react'

interface Props {
  onExportExcel: () => void
  onExportPdf: () => void
  disabled?: boolean
  /** Optional whole-year exports, shown under the regular two. */
  onExportYearExcel?: () => void
  onExportYearPdf?: () => void
}

export function ExportMenu({ onExportExcel, onExportPdf, disabled = false, onExportYearExcel, onExportYearPdf }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
      >
        <FileDown size={15} />
        Export
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 rounded-xl border border-border bg-card shadow-lg z-20 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onExportPdf() }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <FileText size={14} /> Export PDF
          </button>
          <button
            onClick={() => { setOpen(false); onExportExcel() }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Sheet size={14} /> Export Excel
          </button>
          {onExportYearPdf && (
            <button
              onClick={() => { setOpen(false); onExportYearPdf() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
            >
              <FileText size={14} /> Export PDF (setahun)
            </button>
          )}
          {onExportYearExcel && (
            <button
              onClick={() => { setOpen(false); onExportYearExcel() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Sheet size={14} /> Export Excel (setahun)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
