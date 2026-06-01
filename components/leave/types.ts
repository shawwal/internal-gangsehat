export interface LeaveRow {
  id: string
  staff_id: string
  branch_id: string
  start_date: string
  end_date: string
  reason: string
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
  internal_profiles: { full_name: string; email: string } | null
  branches: { name: string } | null
}

export interface BranchOption {
  id: string
  name: string
}

export interface LeaveStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

export interface LeaveFilters {
  search: string
  status: StatusFilter
  branchId: string   // 'all' or uuid
  month: string      // 'all' or '1'–'12'
  year: string       // 'all' or '2024' etc
}

export const DEFAULT_FILTERS: LeaveFilters = {
  search: '',
  status: 'all',
  branchId: 'all',
  month: 'all',
  year: String(new Date().getFullYear()),
}

export const PAGE_SIZE = 10

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

export const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}

export const STATUS_BORDER: Record<string, string> = {
  pending: 'border-l-[var(--secondary)]',
  approved: 'border-l-[var(--chart-4)]',
  rejected: 'border-l-destructive',
}

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function dayCount(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
}
