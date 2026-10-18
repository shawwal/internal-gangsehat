'use client'

import { useEffect, type ReactNode } from 'react'
import { CheckCircle2, X } from 'lucide-react'

export type Notice = { kind: 'success' | 'error'; text: string }

export const inputCls =
  'w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40'

export function RewardStatCard({ label, value, icon, color }: {
  label: string; value: number | string; icon: ReactNode; color: string
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}

export function NoticeBanner({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (!notice) return null
  return (
    <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm ${
      notice.kind === 'success'
        ? 'bg-chart-4/10 border-chart-4/30 text-foreground'
        : 'bg-destructive/10 border-destructive/20 text-destructive'
    }`}>
      {notice.kind === 'success' && <CheckCircle2 size={16} className="text-chart-4 shrink-0 mt-0.5" />}
      <p className="flex-1">{notice.text}</p>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Tutup">
        <X size={14} />
      </button>
    </div>
  )
}

/** Overlay + panel used by every rewards dialog. Esc and outside click close it. */
export function ModalShell({ title, subtitle, icon, onClose, children, footer, maxWidth = 'max-w-lg' }: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-card rounded-2xl border border-border shadow-2xl w-full ${maxWidth} max-h-[85vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border/60">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              {icon}{title}
            </h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border/60">{footer}</div>}
      </div>
    </div>
  )
}
