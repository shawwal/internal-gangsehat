import type { UserRole } from '@/types'

export type { UserRole }

export interface SettingsProfile {
  id: string
  full_name: string
  phone: string | null
  email: string
  role: UserRole
  branch_id: string | null
  branch_name: string | null
  avatar_url: string | null
}

export interface StatusState {
  message: string
  ok: boolean
}

export const ROLE_LABELS: Record<UserRole, string> = {
  director:  'Direktur',
  finance:   'Keuangan',
  hr:        'HR',
  marketing: 'Marketing',
  staff:     'Staff',
  manager:   'Manager',
  therapist: 'Terapis',
  admin:     'Admin',
}
