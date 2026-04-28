import type { UserRole } from '@/types'

export interface NavItem {
  key: string
  label: string
  href?: string
  icon: string
  roles: UserRole[]
  children?: NavItem[]
}

export const navigation: NavItem[] = [
  // Director
  {
    key: 'overview',
    label: 'Overview',
    href: '/director/overview',
    icon: 'LayoutDashboard',
    roles: ['director'],
  },
  {
    key: 'branches',
    label: 'Cabang',
    href: '/director/branches',
    icon: 'Building2',
    roles: ['director'],
  },
  {
    key: 'director-reports',
    label: 'Laporan',
    href: '/director/reports',
    icon: 'FileCheck',
    roles: ['director'],
  },
  {
    key: 'director-staff',
    label: 'Staff',
    href: '/director/staff',
    icon: 'Users',
    roles: ['director'],
  },
  {
    key: 'director-users',
    label: 'Pengguna',
    href: '/director/users',
    icon: 'UserCog',
    roles: ['director'],
  },

  // Finance
  {
    key: 'transactions',
    label: 'Transaksi',
    href: '/finance/transactions',
    icon: 'Receipt',
    roles: ['finance'],
  },
  {
    key: 'finance-reports',
    label: 'Laporan Bulanan',
    href: '/finance/reports',
    icon: 'FileText',
    roles: ['finance'],
  },

  // HR
  {
    key: 'hr-staff',
    label: 'Staff',
    href: '/hr/staff',
    icon: 'Users',
    roles: ['hr'],
  },
  {
    key: 'attendance',
    label: 'Absensi',
    href: '/hr/attendance',
    icon: 'CalendarCheck',
    roles: ['hr'],
  },
  {
    key: 'hr-leave',
    label: 'Cuti',
    href: '/hr/leave',
    icon: 'CalendarOff',
    roles: ['hr'],
  },

  // Leave requests (self-service for non-HR staff)
  {
    key: 'my-leave',
    label: 'Pengajuan Cuti',
    href: '/leave',
    icon: 'CalendarOff',
    roles: ['finance', 'marketing'],
  },

  // Marketing
  {
    key: 'campaigns',
    label: 'Kampanye',
    href: '/marketing/campaigns',
    icon: 'Megaphone',
    roles: ['marketing'],
  },

  // All roles
  {
    key: 'patients',
    label: 'Pasien',
    href: '/patients',
    icon: 'HeartPulse',
    roles: ['director', 'finance', 'hr', 'marketing'],
  },
  {
    key: 'notifications',
    label: 'Notifikasi',
    href: '/notifications',
    icon: 'Bell',
    roles: ['director', 'finance', 'hr', 'marketing'],
  },
  {
    key: 'settings',
    label: 'Pengaturan',
    href: '/settings',
    icon: 'Settings',
    roles: ['director', 'finance', 'hr', 'marketing'],
  },
]

export function navForRole(role: UserRole): NavItem[] {
  return navigation.filter((item) => item.roles.includes(role))
}
