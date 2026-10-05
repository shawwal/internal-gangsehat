// Shared payroll types. Pure module (no imports) so the engine, server actions,
// UI and data_migrations scripts can all use it.

export type Weekday = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'AHAD'

export type PayrollPeriodStatus = 'draft' | 'submitted' | 'locked' | 'paid'

export interface PeriodDay {
  date: string           // YYYY-MM-DD
  workday: boolean
  note: string | null    // holiday name / manual reason
}

/** One cell of the ABS grid: H / I / S / C / A, a number = minutes late, null = empty. */
export type AttendanceCode = 'H' | 'I' | 'S' | 'C' | 'A' | number

export interface AttendanceSummary {
  workdays: number
  hadir: number        // H + late days (late still counts as present)
  lateDays: number
  lateMinutes: number  // TLBT
  izin: number
  sakit: number
  cuti: number
  alfa: number
}

export type OperasionalMode = 'prorata' | 'daily_deduction' | 'none'

export interface BonusTier {
  min_qty: number
  amount: number
  label?: string
}

export interface Compensation {
  gaji_pokok: number
  tj_jabatan: number
  operasional: number
  operasional_mode: OperasionalMode
  operasional_threshold: number
  operasional_daily_rate: number
  insentif_base: number
  incentive_target: number
  incentive_activity_codes: string[]
  bonus_tiers: BonusTier[]
  activity_rates: Record<string, number>
}

export type DeductionBasis = 'late_minutes' | 'late_days' | 'alfa_days' | 'izin_days' | 'sakit_days'

export interface DeductionRule {
  code: string
  label: string
  basis: DeductionBasis
  calc_type: 'fixed' | 'percent_base'
  amount: number
  is_active: boolean
  sort_order: number
}

export interface Adjustment {
  id?: string
  direction: 'debit' | 'credit'
  category: 'DENDA' | 'BONUS' | 'KOREKSI' | 'LAINNYA'
  amount: number
  keterangan: string
}

export type LineKind = 'earning' | 'deduction'

export interface PayrollLine {
  code: string
  label: string
  kind: LineKind
  amount: number
  /** Human-readable formula, for the reconciliation drill-down. */
  detail: string
}

export interface PayrollResult {
  lines: PayrollLine[]
  /** GAJI sheet columns */
  klinik: number          // gaji pokok + tj. jabatan + operasional + insentif
  visit: number           // Σ visit activity × rate
  gross: number
  totalDeductions: number
  net: number             // floored to the rounding unit
  incentiveQty: number
  notes: string           // DENDA keterangan, shown as "Catatan" on the slip
}

export interface ActivityType {
  code: string
  label: string
  group_label: string
  count_mode: 'session' | 'package' | 'manual'
  source_service_types: string[]
  source_layanan_ids: string[]
  max_per_period: number
  sort_order: number
  is_active: boolean
}

export const ADJUSTMENT_CATEGORY_LABEL: Record<Adjustment['category'], string> = {
  DENDA: 'Denda',
  BONUS: 'Bonus',
  KOREKSI: 'Koreksi',
  LAINNYA: 'Lainnya',
}

export const PERIOD_STATUS_LABEL: Record<PayrollPeriodStatus, string> = {
  draft: 'Draft',
  submitted: 'Menunggu Persetujuan',
  locked: 'Dikunci',
  paid: 'Dibayar',
}
