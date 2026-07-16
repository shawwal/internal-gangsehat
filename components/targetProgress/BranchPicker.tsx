'use client'

import { Building2 } from 'lucide-react'
import type { BranchOption } from './types'

interface BranchPickerProps {
  branches: BranchOption[]
  selectedId: string | null
  onChange: (id: string) => void
}

export function BranchPicker({ branches, selectedId, onChange }: BranchPickerProps) {
  return (
    <div className="relative">
      <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <select
        value={selectedId ?? ''}
        onChange={e => onChange(e.target.value)}
        className="h-9 pl-8 pr-3 rounded-xl text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-full sm:w-56"
      >
        <option value="" disabled>Pilih cabang</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  )
}
