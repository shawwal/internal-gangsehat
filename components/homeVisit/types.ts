import type { ServiceType, VisitStatus } from '@/types'
import { STATUS_LABEL, STATUS_BADGE } from '@/components/jadwal/types'

export const HOME_VISIT_SERVICE_TYPES: ServiceType[] = ['TA VISIT', 'SESI VISIT', 'PAKET VISIT']

export { STATUS_LABEL, STATUS_BADGE }

export const HOME_VISIT_STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'scheduled',   label: STATUS_LABEL.scheduled },
  { value: 'completed',   label: STATUS_LABEL.completed },
  { value: 'cancelled',   label: STATUS_LABEL.cancelled },
  { value: 'rescheduled', label: STATUS_LABEL.rescheduled },
]

export interface HomeVisitSessionRow {
  id: string
  visit_date: string
  patient_id: string
  patient_name: string
  patient_address: string | null
  no_rm: string | null
  branch_id: string
  branch_name: string
  service_type: ServiceType | null
  status: VisitStatus
  attending_staff_name: string | null
  package: { jenis_paket: 'P1' | 'P2' | null; used_sessions: number; total_sessions: number } | null
  payment_status: 'LUNAS' | 'DP' | 'PELUNASAN' | null
  payment_outstanding: number
  has_payment: boolean
}

export interface HomeVisitStatsData {
  totalPatients: number
  activePackages: number
  visitsThisMonth: number
  noPackageYet: number
}

export const INPUT_CLS = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
export const LABEL_CLS = 'block text-xs font-medium text-foreground mb-1'
