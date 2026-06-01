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
    key: 'director-users',
    label: 'Staff & Pengguna',
    href: '/director/users',
    icon: 'UserCog',
    roles: ['director'],
  },
  {
    key: 'director-leave',
    label: 'Cuti Staff',
    href: '/director/leave',
    icon: 'CalendarOff',
    roles: ['director'],
  },
  {
    key: 'director-targets',
    label: 'Target Staff',
    href: '/director/targets',
    icon: 'Target',
    roles: ['director'],
  },

  // Finance
  {
    key: 'finance-home',
    label: 'Beranda',
    href: '/finance',
    icon: 'LayoutDashboard',
    roles: ['finance'],
  },
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
    key: 'hr-home',
    label: 'Beranda',
    href: '/hr',
    icon: 'LayoutDashboard',
    roles: ['hr'],
  },
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

  // Target (self-service for all non-director staff)
  {
    key: 'my-targets',
    label: 'Target',
    href: '/my-targets',
    icon: 'Target',
    roles: ['finance', 'hr', 'marketing', 'staff'],
  },

  // Marketing
  {
    key: 'marketing-home',
    label: 'Beranda',
    href: '/marketing',
    icon: 'LayoutDashboard',
    roles: ['marketing'],
  },
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
    roles: ['director', 'finance', 'hr', 'marketing', 'staff'],
  },
  {
    key: 'settings',
    label: 'Pengaturan',
    href: '/settings',
    icon: 'Settings',
    roles: ['director', 'finance', 'hr', 'marketing', 'staff'],
  },
]

export function navForRole(role: UserRole): NavItem[] {
  return navigation.filter((item) => item.roles.includes(role))
}
