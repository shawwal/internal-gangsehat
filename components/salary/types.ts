export interface PayrollRecord {
  id: string
  staff_id: string
  branch_id: string | null
  period_month: number
  period_year: number
  base_salary: number
  transport_allowance: number
  meal_allowance: number
  other_allowance: number
  bonus_achievement: number
  deductions: number
  notes: string | null
  status: 'draft' | 'confirmed' | 'paid'
  confirmed_by: string | null
  confirmed_at: string | null
  paid_at: string | null
  transaction_id: string | null
  created_at: string
  updated_at: string
  // joins
  internal_profiles: { full_name: string; role: string } | null
  branches: { name: string } | null
}

export interface SalarySetting {
  id: string
  role: string
  base_salary: number
  transport_allowance: number
  meal_allowance: number
  bonus_target_pct: number
  updated_at: string
}

export interface EmployeeSalary {
  id: string
  staff_id: string
  base_salary: number | null        // NULL = use role default
  transport_allowance: number | null
  meal_allowance: number | null
  other_allowance: number
  notes: string | null
  updated_at: string
  created_at: string
  // joined from internal_profiles
  internal_profiles: {
    full_name: string
    role: string
    branch_id: string | null
    branches: { name: string } | null
  } | null
}

export type PayrollStatus = 'all' | 'draft' | 'confirmed' | 'paid'

export interface PayrollFiltersState {
  status: PayrollStatus
  branchId: string   // 'all' or uuid — ignored for manager (RLS scopes)
  month: number      // 1–12
  year: number
}

export interface PayrollStats {
  total: number
  draft: number
  confirmed: number
  paid: number
}

export const PAGE_SIZE = 10

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Dikonfirmasi',
  paid: 'Dibayar',
}

export const PAYROLL_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  confirmed: 'bg-secondary/20 text-secondary-foreground',
  paid: 'bg-chart-4/15 text-chart-4',
}

export const PAYROLL_STATUS_BORDER: Record<string, string> = {
  draft: 'border-l-muted-foreground/40',
  confirmed: 'border-l-[var(--secondary)]',
  paid: 'border-l-[var(--chart-4)]',
}

export const ROLE_LABELS: Record<string, string> = {
  director: 'Direktur',
  manager: 'Manajer',
  finance: 'Keuangan',
  hr: 'HR',
  marketing: 'Marketing',
  therapist: 'Terapis',
  staff: 'Staff',
}

export const ALL_ROLES = ['director', 'manager', 'finance', 'hr', 'marketing', 'therapist', 'staff']

/** "Rp 10.000.000" — full currency label for display/invoice */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** "10.000.000" — plain dots-separated number (no Rp prefix) */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount)
}

/**
 * Human-readable Indonesian denomination label.
 * 10_000_000 → "10 juta"
 * 1_500_000  → "1 juta 500 ribu"
 *   500_000  → "500 ribu"
 *    50_000  → "50 ribu"
 *         0  → "" (empty — caller decides what to show)
 */
export function toHumanIDR(amount: number): string {
  if (amount <= 0) return ''
  const juta = Math.floor(amount / 1_000_000)
  const sisaJuta = amount % 1_000_000
  const ribu = Math.floor(sisaJuta / 1_000)
  const sisaRibu = sisaJuta % 1_000
  const parts: string[] = []
  if (juta > 0) parts.push(`${juta} juta`)
  if (ribu > 0) parts.push(`${ribu} ribu`)
  if (parts.length === 0 && sisaRibu > 0) parts.push(`${sisaRibu}`)
  return parts.join(' ')
}

export function calcGross(r: Pick<PayrollRecord, 'base_salary' | 'transport_allowance' | 'meal_allowance' | 'other_allowance' | 'bonus_achievement'>): number {
  return r.base_salary + r.transport_allowance + r.meal_allowance + r.other_allowance + r.bonus_achievement
}

export function calcNet(r: Pick<PayrollRecord, 'base_salary' | 'transport_allowance' | 'meal_allowance' | 'other_allowance' | 'bonus_achievement' | 'deductions'>): number {
  return calcGross(r) - r.deductions
}
