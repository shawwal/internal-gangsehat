'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ title, subtitle, onClose, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-card rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl w-full ${WIDTH[size]} max-h-[90dvh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 -m-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto min-h-0 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border flex flex-wrap justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">{footer}</div>}
      </div>
    </div>
  )
}

export const btn = {
  primary: 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition',
  secondary: 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition',
  ghost: 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition',
  danger: 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition',
}

export const inputCls = 'w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
export const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'
