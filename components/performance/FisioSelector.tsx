'use client'

import type { FisioInfo } from './types'

interface FisioSelectorProps {
  fisioList: FisioInfo[]
  value: string | null
  onChange: (id: string | null) => void
}

export function FisioSelector({ fisioList, value, onChange }: FisioSelectorProps) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className={
        'h-8 px-2.5 rounded-xl text-sm border border-border bg-card text-foreground ' +
        'focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ' +
        'transition-colors hover:border-primary/50'
      }
      aria-label="Pilih fisioterapis"
    >
      <option value="">Semua Fisio</option>
      {fisioList.map(f => (
        <option key={f.id} value={f.id}>{f.name}</option>
      ))}
    </select>
  )
}
