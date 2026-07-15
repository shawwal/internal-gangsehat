'use client'

import { Sparkles, ListChecks } from 'lucide-react'
import type { PaketSubMode } from './types'

interface Props {
  subMode: PaketSubMode
  setSubMode: (m: PaketSubMode) => void
}

const TABS: { value: PaketSubMode; label: string; icon: React.ReactNode }[] = [
  { value: 'pilih', label: 'Pilih Paket', icon: <ListChecks size={12} /> },
  { value: 'baru',  label: 'Paket Baru',  icon: <Sparkles size={12} /> },
]

export function SubModeToggle({ subMode, setSubMode }: Props) {
  return (
    <div className="flex gap-1.5 p-1 rounded-xl bg-white/5 border border-border/30">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setSubMode(tab.value)}
          className={[
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer',
            subMode === tab.value
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
