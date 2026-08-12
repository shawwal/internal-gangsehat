import type { BodyRegion, ServiceType, VisitStatus } from '@/types'

export const HOME_VISIT_SERVICE_TYPES: ServiceType[] = ['TA VISIT', 'SESI VISIT', 'PAKET VISIT']

export interface HomeVisitPackageInfo {
  jenis_paket: 'P1' | 'P2' | null
  used_sessions: number
  total_sessions: number
  status: 'active' | 'completed' | 'cancelled' | 'stopped'
  payment_status: 'LUNAS' | 'DP' | null
  outstanding: number
}

export interface HomeVisitPatientRow {
  patient_id: string
  patient_name: string
  no_rm: string | null
  branch_id: string | null
  branch_name: string
  last_visit_date: string
  last_service_type: ServiceType | null
  last_kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  package: HomeVisitPackageInfo | null
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
  kehadiran:          '' as 'HADIR' | 'TIDAK HADIR' | '',
  regio:              '' as BodyRegion | '',
  sumber_pasien:      '',
  chief_complaint:    '',
  diagnosis:          '',
  treatment:          '',
  status:             'scheduled' as VisitStatus,
  notes:              '',
}

export type VisitFormState = typeof VISIT_FORM_DEFAULT

export const INPUT_CLS = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
export const LABEL_CLS = 'block text-xs font-medium text-foreground mb-1'
