import type { BodyRegion, ServiceType, VisitStatus } from '@/types'

export const HOME_VISIT_SERVICE_TYPES: ServiceType[] = ['TA VISIT', 'SESI VISIT', 'PAKET VISIT']

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

export const VISIT_FORM_DEFAULT = {
  visit_date:         new Date().toISOString().split('T')[0],
  attending_staff_id: '',
  service_type:       '' as ServiceType | '',
  shift:              '' as 'PAGI' | 'SORE' | '',
  kehadiran:          'HADIR' as 'HADIR' | 'TIDAK HADIR' | '',
  regio:              '' as BodyRegion | '',
  sumber_pasien:      '',
  chief_complaint:    '',
  diagnosis:          '',
  treatment:          '',
  status:             'completed' as VisitStatus,
  notes:              '',
}

export type VisitFormState = typeof VISIT_FORM_DEFAULT

export const INPUT_CLS = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
export const LABEL_CLS = 'block text-xs font-medium text-foreground mb-1'
