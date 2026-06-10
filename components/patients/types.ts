import type { PatientPlain } from '@/app/actions/patients'

export type GenderFilter = 'all' | 'male' | 'female' | 'other'
export type SortField   = 'name' | 'created_at' | 'no_rm'
export type SortOrder   = 'asc' | 'desc'
export type ViewMode    = 'grid' | 'table'

export interface PatientFiltersState {
  search:    string
  gender:    GenderFilter
  sortField: SortField
  sortOrder: SortOrder
}

export const DEFAULT_FILTERS: PatientFiltersState = {
  search:    '',
  gender:    'all',
  sortField: 'created_at',
  sortOrder: 'desc',
}

export const PAGE_SIZE = 10

export const GENDER_LABEL: Record<string, string> = {
  male:   'Laki-laki',
  female: 'Perempuan',
  other:  'Lainnya',
}

export const GENDER_TABS: { key: GenderFilter; label: string }[] = [
  { key: 'all',    label: 'Semua' },
  { key: 'male',   label: 'Laki-laki' },
  { key: 'female', label: 'Perempuan' },
  { key: 'other',  label: 'Lainnya' },
]

export const AVATAR_COLORS: Record<string, string> = {
  male:   'bg-blue-500/15 text-blue-600',
  female: 'bg-primary/15 text-primary',
  other:  'bg-secondary/20 text-secondary-foreground',
}

export function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function formatDate(d: string) {
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function applyFilters(
  patients: PatientPlain[],
  filters: PatientFiltersState,
): PatientPlain[] {
  let result = patients.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      (p.phone ?? '').includes(filters.search)
    const matchGender = filters.gender === 'all' || p.gender === filters.gender
    return matchSearch && matchGender
  })

  result = [...result].sort((a, b) => {
    const mul = filters.sortOrder === 'asc' ? 1 : -1
    if (filters.sortField === 'name') {
      return mul * a.name.localeCompare(b.name, 'id')
    }
    if (filters.sortField === 'no_rm') {
      return mul * ((a.no_rm ?? '').localeCompare(b.no_rm ?? '', 'id'))
    }
    // created_at
    return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  })

  return result
}

export type { PatientPlain }
