import type { UserRole } from '@/types'

export type NavGroup = 'dashboard' | 'management' | 'hr' | 'operations' | 'finance' | 'schedule' | 'clinic' | 'marketing' | 'system'

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  dashboard:  'Beranda',
  management: 'Manajemen',
  hr:         'Tim & HR',
  operations: 'Operasional',
  finance:    'Keuangan',
  schedule:   'Jadwal',
  clinic:     'Klinik',
  marketing:  'Marketing',
  system:     'Sistem',
}

export interface NavItem {
  key: string
  label: string
  href?: string
  icon: string
  roles: UserRole[]
  group: NavGroup
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
    group: 'dashboard',
  },
  {
    key: 'branches',
    label: 'Cabang',
    href: '/director/branches',
    icon: 'Building2',
    roles: ['director'],
    group: 'management',
  },
  {
    key: 'director-schedule-slots',
    label: 'Slot Jadwal',
    href: '/director/schedule-slots',
    icon: 'Clock',
    roles: ['director'],
    group: 'management',
  },
  {
    key: 'director-reports',
    label: 'Laporan',
    href: '/director/reports',
    icon: 'FileCheck',
    roles: ['director'],
    group: 'management',
  },
  {
    key: 'director-analytics',
    label: 'Statistik',
    href: '/director/analytics',
    icon: 'BarChart2',
    roles: ['director'],
    group: 'management',
  },
  {
    key: 'director-performance',
    label: 'Performa',
    href: '/director/performance',
    icon: 'Trophy',
    roles: ['director'],
    group: 'management',
  },
  {
    key: 'director-users',
    label: 'Staff & Pengguna',
    href: '/director/users',
    icon: 'UserCog',
    roles: ['director'],
    group: 'hr',
  },
  {
    key: 'director-leave',
    label: 'Cuti Staff',
    href: '/director/leave',
    icon: 'CalendarOff',
    roles: ['director'],
    group: 'hr',
  },
  {
    key: 'director-targets',
    label: 'Target',
    href: '/director/targets',
    icon: 'Target',
    roles: ['director', 'manager'],
    group: 'hr',
  },
  {
    key: 'director-orders',
    label: 'Semua Order',
    href: '/director/orders',
    icon: 'ClipboardList',
    roles: ['director'],
    group: 'operations',
  },
  {
    key: 'director-payroll',
    label: 'Penggajian',
    href: '/director/payroll',
    icon: 'Wallet',
    roles: ['director', 'manager'],
    group: 'operations',
  },
  {
    key: 'director-import',
    label: 'Import Pasien',
    href: '/director/import',
    icon: 'FileUp',
    roles: ['director'],
    group: 'management',
  },
  {
    key: 'director-finance',
    label: 'Keuangan',
    href: '/director/finance',
    icon: 'Landmark',
    roles: ['director'],
    group: 'finance',
  },
  {
    key: 'director-layanan',
    label: 'Tarif Layanan',
    href: '/director/layanan',
    icon: 'Tag',
    roles: ['director'],
    group: 'management',
  },
  {
    key: 'director-reminder-template',
    label: 'Template Pesan WA',
    href: '/director/reminder-template',
    icon: 'MessageCircle',
    roles: ['director'],
    group: 'management',
  },

  // Finance
  {
    key: 'finance-home',
    label: 'Beranda',
    href: '/finance',
    icon: 'LayoutDashboard',
    roles: ['finance'],
    group: 'dashboard',
  },
  {
    key: 'transactions',
    label: 'Transaksi',
    href: '/finance/transactions',
    icon: 'Receipt',
    roles: ['finance', 'admin'],
    group: 'finance',
  },
  {
    key: 'finance-reports',
    label: 'Laporan Bulanan',
    href: '/finance/reports',
    icon: 'FileText',
    roles: ['finance'],
    group: 'finance',
  },

  // HR
  {
    key: 'hr-home',
    label: 'Beranda',
    href: '/hr',
    icon: 'LayoutDashboard',
    roles: ['hr'],
    group: 'dashboard',
  },
  {
    key: 'hr-staff',
    label: 'Staff',
    href: '/hr/staff',
    icon: 'Users',
    roles: ['hr'],
    group: 'hr',
  },
  {
    key: 'attendance',
    label: 'Absensi',
    href: '/hr/attendance',
    icon: 'CalendarCheck',
    roles: ['hr'],
    group: 'hr',
  },
  {
    key: 'hr-leave',
    label: 'Cuti',
    href: '/hr/leave',
    icon: 'CalendarOff',
    roles: ['hr'],
    group: 'hr',
  },

  // Master Jadwal — director + HR only (full staff schedule management)
  {
    key: 'schedules',
    label: 'Master Jadwal',
    href: '/hr/schedules',
    icon: 'CalendarDays',
    roles: ['director', 'hr'],
    group: 'schedule',
  },

  // Daily schedule + patient assignment — HR, manager, therapist, staff, director
  {
    key: 'jadwal-harian',
    label: 'Jadwal Harian',
    href: '/jadwal-harian',
    icon: 'CalendarClock',
    roles: ['director', 'hr', 'manager', 'therapist', 'staff', 'admin'],
    group: 'schedule',
  },

  // My Schedule — every role can manage their own schedule
  {
    key: 'my-schedule',
    label: 'Jadwal Saya',
    href: '/my-schedule',
    icon: 'CalendarDays',
    roles: ['director', 'hr', 'finance', 'marketing', 'therapist', 'staff', 'manager', 'admin'],
    group: 'schedule',
  },

  // Leave requests (self-service for non-HR staff)
  {
    key: 'my-leave',
    label: 'Pengajuan Cuti',
    href: '/leave',
    icon: 'CalendarOff',
    roles: ['finance', 'marketing', 'therapist', 'manager', 'admin', 'staff'],
    group: 'hr',
  },

  // Team leave view (read-only) — admin only
  {
    key: 'admin-leave',
    label: 'Cuti Staff',
    href: '/admin/leave',
    icon: 'CalendarOff',
    roles: ['admin'],
    group: 'hr',
  },

  // Target (self-service for all non-director staff)
  {
    key: 'my-targets',
    label: 'Target',
    href: '/my-targets',
    icon: 'Target',
    roles: ['finance', 'hr', 'marketing', 'staff', 'therapist', 'manager'],
    group: 'hr',
  },

  // Marketing
  {
    key: 'marketing-home',
    label: 'Beranda',
    href: '/marketing',
    icon: 'LayoutDashboard',
    roles: ['marketing'],
    group: 'dashboard',
  },
  {
    key: 'campaigns',
    label: 'Kampanye',
    href: '/marketing/campaigns',
    icon: 'Megaphone',
    roles: ['marketing', 'manager'],
    group: 'marketing',
  },

  // Manager — cross-domain branch access
  {
    key: 'manager-transactions',
    label: 'Transaksi',
    href: '/finance/transactions',
    icon: 'Receipt',
    roles: ['manager'],
    group: 'finance',
  },
  {
    key: 'manager-reports',
    label: 'Laporan Bulanan',
    href: '/finance/reports',
    icon: 'FileText',
    roles: ['manager'],
    group: 'finance',
  },
  {
    key: 'manager-staff',
    label: 'Staff',
    href: '/hr/staff',
    icon: 'Users',
    roles: ['manager'],
    group: 'hr',
  },
  {
    key: 'manager-attendance',
    label: 'Absensi',
    href: '/hr/attendance',
    icon: 'CalendarCheck',
    roles: ['manager'],
    group: 'hr',
  },
  {
    key: 'manager-leave',
    label: 'Cuti Staff',
    href: '/hr/leave',
    icon: 'CalendarOff',
    roles: ['manager'],
    group: 'hr',
  },

  // All roles
  {
    key: 'patients',
    label: 'Pasien',
    href: '/patients',
    icon: 'HeartPulse',
    roles: ['director', 'finance', 'hr', 'marketing', 'therapist', 'manager', 'admin'],
    group: 'clinic',
  },
  {
    key: 'patient-analytics',
    label: 'Analitik Pasien',
    href: '/director/patients',
    icon: 'PieChart',
    roles: ['director'],
    group: 'clinic',
  },
  {
    key: 'notifications',
    label: 'Notifikasi',
    href: '/notifications',
    icon: 'Bell',
    roles: ['director', 'finance', 'hr', 'marketing', 'staff', 'therapist', 'manager', 'admin'],
    group: 'system',
  },
  {
    key: 'settings',
    label: 'Pengaturan',
    href: '/settings',
    icon: 'Settings',
    roles: ['director', 'finance', 'hr', 'marketing', 'staff', 'therapist', 'manager', 'admin'],
    group: 'system',
  },
]

export function navForRole(role: UserRole): NavItem[] {
  return navigation.filter((item) => item.roles.includes(role))
}
