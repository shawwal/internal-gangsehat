'use client'

import { Check, CloudOff, Loader2 } from 'lucide-react'
import type { AutoSaveStatus } from '@/hooks/useAutoSave'

interface Props {
  status: AutoSaveStatus
  savedAt: Date | null
  className?: string
}

export function AutoSaveIndicator({ status, savedAt, className = '' }: Props) {
  if (status === 'idle') {
    return <span className={`text-[11px] text-muted-foreground ${className}`}>Tersimpan otomatis</span>
  }
  if (status === 'saving') {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className}`}>
        <Loader2 size={11} className="animate-spin" /> Menyimpan draf...
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-destructive ${className}`}>
        <CloudOff size={11} /> Gagal menyimpan otomatis — coba lagi
      </span>
    )
  }
  const time = savedAt?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-[#34C759] ${className}`}>
      <Check size={11} /> Draf tersimpan{time && ` · ${time}`}
    </span>
  )
}
