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
    key: 'director-analytics',
    label: 'Statistik',
    href: '/director/analytics',
    icon: 'BarChart2',
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
    label: 'Target',
    href: '/director/targets',
    icon: 'Target',
    roles: ['director', 'manager'],
  },
  {
    key: 'director-orders',
    label: 'Semua Order',
    href: '/director/orders',
    icon: 'ClipboardList',
    roles: ['director'],
  },
  {
    key: 'director-payroll',
    label: 'Penggajian',
    href: '/director/payroll',
    icon: 'Wallet',
    roles: ['director', 'manager'],
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

  // Master Jadwal — director + HR only (full staff schedule management)
  {
    key: 'schedules',
    label: 'Master Jadwal',
    href: '/hr/schedules',
    icon: 'CalendarDays',
    roles: ['director', 'hr'],
  },

  // My Schedule — every role can manage their own schedule
  {
    key: 'my-schedule',
    label: 'Jadwal Saya',
    href: '/my-schedule',
    icon: 'CalendarDays',
    roles: ['director', 'hr', 'finance', 'marketing', 'therapist', 'staff', 'manager'],
  },

  // Leave requests (self-service for non-HR staff)
  {
    key: 'my-leave',
    label: 'Pengajuan Cuti',
    href: '/leave',
    icon: 'CalendarOff',
    roles: ['finance', 'marketing', 'therapist', 'manager'],
  },

  // Target (self-service for all non-director staff)
  {
    key: 'my-targets',
    label: 'Target',
    href: '/my-targets',
    icon: 'Target',
    roles: ['finance', 'hr', 'marketing', 'staff', 'therapist', 'manager'],
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
    roles: ['marketing', 'manager'],
  },

  // Manager — cross-domain branch access
  {
    key: 'manager-transactions',
    label: 'Transaksi',
    href: '/finance/transactions',
    icon: 'Receipt',
    roles: ['manager'],
  },
  {
    key: 'manager-reports',
    label: 'Laporan Bulanan',
    href: '/finance/reports',
    icon: 'FileText',
    roles: ['manager'],
  },
  {
    key: 'manager-staff',
    label: 'Staff',
    href: '/hr/staff',
    icon: 'Users',
    roles: ['manager'],
  },
  {
    key: 'manager-attendance',
    label: 'Absensi',
    href: '/hr/attendance',
    icon: 'CalendarCheck',
    roles: ['manager'],
  },
  {
    key: 'manager-leave',
    label: 'Cuti Staff',
    href: '/hr/leave',
    icon: 'CalendarOff',
    roles: ['manager'],
  },

  // All roles
  {
    key: 'patients',
    label: 'Pasien',
    href: '/patients',
    icon: 'HeartPulse',
    roles: ['director', 'finance', 'hr', 'marketing', 'therapist', 'manager'],
  },
  {
    key: 'notifications',
    label: 'Notifikasi',
    href: '/notifications',
    icon: 'Bell',
    roles: ['director', 'finance', 'hr', 'marketing', 'staff', 'therapist', 'manager'],
  },
  {
    key: 'settings',
    label: 'Pengaturan',
    href: '/settings',
    icon: 'Settings',
    roles: ['director', 'finance', 'hr', 'marketing', 'staff', 'therapist', 'manager'],
  },
]

export function navForRole(role: UserRole): NavItem[] {
  return navigation.filter((item) => item.roles.includes(role))
}
