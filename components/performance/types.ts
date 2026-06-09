export interface Branch {
  id: string
  name: string
}

export interface FisioInfo {
  id: string
  name: string
  avatar_url?: string | null
}

export interface StaffTargetRow {
  staff_id: string
  target_ta: number
  target_paket_klinik: number
  target_kunjungan: number
  target_visit: number
  internal_profiles: { full_name: string } | null
}

export interface VisitRow {
  id: string
  service_type: string | null
  attending_staff_id: string | null
  visit_date: string
  patients: { no_rm: string | null } | null
  internal_profiles: { full_name: string } | null
}

export interface VisitForPerforma {
  visit_date: string
  service_type: string | null
  attending_staff_id: string | null
}

export interface VisitForLeaderboard {
  attending_staff_id: string | null
  service_type: string | null
  internal_profiles: { full_name: string; avatar_url: string | null } | null
}

export interface FisioStats {
  staff_id: string
  name: string
  avatar_url: string | null
  ta: number       // TERAPI AWAL + TA VISIT
  paket: number    // PAKET TERAPI + PAKET VISIT
  sesi: number     // SESI TERAPI + SESI VISIT
  total: number
}

export interface FisioBarData {
  name: string      // short name for X-axis
  fullName: string  // full name for tooltip
  ta: number
}

export interface KpiCardData {
  label: string
  actual: number
  target: number
  color: string
}

export interface MonthlyData {
  month: string
  ta: number
  paket: number
  sesi: number
  total: number
}

export type PeriodMode = 'bulan' | 'minggu'
export type ViewMode = 'individual' | 'tim'
export type PerformanceTab = 'kontrol' | 'performa' | 'terbaik'
