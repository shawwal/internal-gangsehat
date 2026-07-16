'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, BellRing } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

const STYLES: Record<ToastType, string> = {
  success: 'bg-chart-4/10 text-chart-4 border border-chart-4/20',
  error:   'bg-destructive/10 text-destructive border border-destructive/20',
  info:    'bg-blue-500/15 text-blue-300 border border-blue-400/30',
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={15} />,
  error:   <XCircle size={15} />,
  info:    <BellRing size={15} />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium shadow-lg pointer-events-auto ${STYLES[t.type]}`}
          >
            {ICONS[t.type]}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
