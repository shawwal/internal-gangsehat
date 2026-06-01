'use client'

import { useEffect, useState } from 'react'
import { Eye, FileText, X } from 'lucide-react'

interface Props {
  url: string
}

export function ProofDialog({ url }: Props) {
  const [open, setOpen] = useState(false)
  const isPdf = /\.pdf$/i.test(url)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div className="flex items-center gap-2 mt-2">
        {isPdf ? (
          <div
            className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setOpen(true)}
          >
            <FileText size={18} className="text-muted-foreground" />
          </div>
        ) : (
          <img
            src={url}
            alt="Bukti"
            className="w-10 h-10 rounded-lg object-cover border border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setOpen(true)}
          />
        )}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Lihat Bukti <Eye size={11} />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <p className="text-sm font-semibold text-foreground">Bukti / Surat Sakit</p>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {isPdf ? (
                <iframe
                  src={url}
                  title="Bukti PDF"
                  className="w-full h-[70vh] rounded-xl border border-border"
                />
              ) : (
                <img
                  src={url}
                  alt="Bukti"
                  className="max-w-full max-h-[70vh] object-contain rounded-xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
