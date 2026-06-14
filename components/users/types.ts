import type { UserRole } from '@/types'

export type { UserRole }

export interface UserRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  branch_id: string | null
  is_active: boolean
  created_at: string
  nickname: string | null
  branches: { name: string } | null
}

export interface BranchOption { id: string; name: string }

export type Tab = 'staff' | 'director'

export const ROLE_LABELS: Record<UserRole, string> = {
  director:  'Direktur',
  finance:   'Keuangan',
  hr:        'HR',
  marketing: 'Marketing',
  staff:     'Staff',
  therapist: 'Terapis',
  manager:   'Manager',
}

export const ROLE_COLOR: Record<UserRole, string> = {
  director:  'bg-primary/10 text-primary',
  finance:   'bg-blue-500/15 text-blue-500',
  hr:        'bg-violet-500/15 text-violet-500',
  marketing: 'bg-secondary/20 text-secondary-foreground',
  staff:     'bg-muted text-muted-foreground',
  therapist: 'bg-green-500/15 text-green-600',
  manager:   'bg-orange-500/15 text-orange-600',
}

export const STAFF_ROLES: UserRole[] = ['finance', 'hr', 'marketing', 'staff', 'therapist', 'manager']

export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
