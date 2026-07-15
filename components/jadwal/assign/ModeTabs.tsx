'use client'

import { User, CalendarDays, Package } from 'lucide-react'

export type VisitMode = 'terapi_awal' | 'single' | 'recurring' | 'paket'

interface Props {
  mode: VisitMode
  setMode: (m: VisitMode) => void
}

const TABS: { value: VisitMode; label: string; icon: React.ReactNode }[] = [
  { value: 'terapi_awal', label: 'Terapi Awal',      icon: <User size={12} /> },
  { value: 'single',      label: 'Satu Sesi',         icon: <CalendarDays size={12} /> },
  // 'Jadwal Berulang' temporarily hidden — logic kept in AssignDialog for an easy re-enable.
  // { value: 'recurring', label: 'Jadwal Berulang', icon: <Repeat2 size={12} /> },
  { value: 'paket',       label: 'Paket',             icon: <Package size={12} /> },
]

export function ModeTabs({ mode, setMode }: Props) {
  return (
    <div className="flex gap-1.5 p-1 rounded-xl bg-white/5 border border-border/30">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setMode(tab.value)}
          className={[
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer',
            mode === tab.value
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
          ].join(' ')}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
