'use client'

import { Search, X } from 'lucide-react'
import { SORT_LABEL, STATUS_LABEL, chipCls, inputCls, type SortKey, type StatusFilter } from './constants'

export interface StudentFilterState {
  search: string
  status: StatusFilter
  onlyPending: boolean
  sort: SortKey
}

export const DEFAULT_FILTERS: StudentFilterState = {
  search: '', status: 'active', onlyPending: false, sort: 'name',
}

export function StudentFilters({ value, onChange }: {
  value: StudentFilterState; onChange: (patch: Partial<StudentFilterState>) => void
}) {
  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={value.search} onChange={(e) => onChange({ search: e.target.value })} placeholder="Cari nama atau keluhan..."
          className={`w-full pl-8 pr-9 py-2.5 ${inputCls.replace('px-3 py-2 ', '')}`} />
        {value.search && (
          <button onClick={() => onChange({ search: '' })} aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Chips scroll horizontally on phones instead of wrapping into a tall block. */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(['active', 'graduated', 'inactive', 'all'] as StatusFilter[]).map((s) => (
          <button key={s} onClick={() => onChange({ status: s })} className={chipCls(value.status === s)}>
            {s === 'all' ? 'Semua' : STATUS_LABEL[s]}
          </button>
        ))}
        <span className="w-px h-5 bg-border shrink-0" />
        <button onClick={() => onChange({ onlyPending: !value.onlyPending })} className={chipCls(value.onlyPending)}>
          Rekam medis belum
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select value={value.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}
          aria-label="Urutkan" className={`w-full sm:w-auto ${inputCls}`}>
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
        </select>
      </div>
    </div>
  )
}
