export interface TargetRow {
  id: string
  staff_id: string
  branch_id: string
  bulan: number
  tahun: number
  target_ta: number
  target_paket_klinik: number
  target_kunjungan: number
  target_visit: number
  notes: string | null
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

export interface TargetStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

export interface TargetFilters {
  search: string
  status: StatusFilter
  branchId: string   // 'all' or uuid
  month: string      // 'all' or '1'–'12'
  year: string       // 'all' or '2024' etc
}

export const DEFAULT_FILTERS: TargetFilters = {
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

// ── Branch Targets ─────────────────────────────────────────────────────────

export interface BranchTargetRow {
  id: string
  branch_id: string
  bulan: number
  tahun: number
  target_ta: number
  target_paket_klinik: number
  target_kunjungan: number
  target_visit: number
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
  branches: { name: string } | null
  // Only set_by join to avoid PostgREST dual-FK collision with reviewed_by
  internal_profiles: { full_name: string } | null
}

export interface BranchTargetFilters {
  status: StatusFilter
  branchId: string   // 'all' or uuid — ignored for manager (RLS scopes it)
  month: string      // 'all' or '1'–'12'
  year: string
}

export const DEFAULT_BRANCH_FILTERS: BranchTargetFilters = {
  status: 'all',
  branchId: 'all',
  month: 'all',
  year: String(new Date().getFullYear()),
}
