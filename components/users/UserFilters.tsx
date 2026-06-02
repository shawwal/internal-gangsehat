import { Search, ChevronDown } from 'lucide-react'
import { STAFF_ROLES, ROLE_LABELS } from './types'
import type { Tab, BranchOption, UserRole } from './types'

interface Props {
  tab: Tab
  search: string
  roleFilter: UserRole | ''
  branchFilter: string
  branches: BranchOption[]
  activeCount: number
  totalCount: number
  onSearch: (v: string) => void
  onRoleFilter: (v: UserRole | '') => void
  onBranchFilter: (v: string) => void
}

export function UserFilters({
  tab, search, roleFilter, branchFilter, branches,
  activeCount, totalCount, onSearch, onRoleFilter, onBranchFilter,
}: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-48 max-w-64">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Cari nama atau email..."
          className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {tab === 'staff' && (
        <>
          {/* Role filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => onRoleFilter(e.target.value as UserRole | '')}
              className="appearance-none pl-3 pr-7 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            >
              <option value="">Semua Role</option>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Branch filter */}
          <div className="relative">
            <select
              value={branchFilter}
              onChange={(e) => onBranchFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            >
              <option value="">Semua Cabang</option>
              <option value="__none__">Belum ditentukan</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </>
      )}

      {/* Stats badge */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full border border-border">
          {activeCount} aktif dari {totalCount}
        </span>
      </div>
    </div>
  )
}
