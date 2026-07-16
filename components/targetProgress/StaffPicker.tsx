'use client'

import { Search, User } from 'lucide-react'
import type { StaffOption } from './types'

interface StaffPickerProps {
  staff: StaffOption[]
  selectedId: string | null
  onChange: (id: string) => void
  search: string
  onSearchChange: (v: string) => void
}

export function StaffPicker({ staff, selectedId, onChange, search, onSearchChange }: StaffPickerProps) {
  const filtered = search.trim()
    ? staff.filter(s => s.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    : staff

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Cari staff..."
          className="h-9 pl-8 pr-3 rounded-xl text-sm border border-border bg-card text-foreground w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="relative">
        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <select
          value={selectedId ?? ''}
          onChange={e => onChange(e.target.value)}
          className="h-9 pl-8 pr-3 rounded-xl text-sm border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-full sm:w-56"
        >
          <option value="" disabled>Pilih staff</option>
          {filtered.map(s => (
            <option key={s.id} value={s.id}>
              {s.full_name}{s.branches?.name ? ` — ${s.branches.name}` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
