// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrderRow = any

export interface Stats {
  total: number
  booking: number
  confirmed: number
  inProgress: number
  completed: number
  cancelled: number
  belumLunas: number
  lunas: number
}

export interface PackageOrderRow {
  id: string
  kode_transaksi: string
  patient_name: string
  patient_phone: string
  patient_id: string | null
  service_type: string
  status: string
  admin_name: string
  total_sessions: number
  last_hadir_date: string | null
  next_session_date: string | null
  days_since_last: number | null
}

export interface PackageStats {
  activePackages: number
  overdueCount: number
  completedThisMonth: number
}

/** Returns Tailwind classes for JARAK HARI badge */
export function daysColor(days: number | null): string {
  if (days === null) return 'bg-muted text-muted-foreground'
  if (days < 14)    return 'bg-chart-4/15 text-chart-4'
  if (days < 30)    return 'bg-secondary/20 text-secondary-foreground'
  return 'bg-destructive/10 text-destructive'
}
