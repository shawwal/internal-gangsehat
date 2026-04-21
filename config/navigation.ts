export interface NavItem {
  key: string
  href?: string
  icon: string
  roles?: string[]
  children?: NavItem[]
}

export const navigation: NavItem[] = [
  {
    key: 'nav.dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    key: 'nav.order',
    icon: 'ShoppingBag',
    children: [
      { key: 'nav.order_list',     href: '/order',          icon: 'List'    },
      { key: 'nav.order_packages', href: '/order/packages', icon: 'Package' },
    ],
  },
  {
    key: 'nav.master_data',
    icon: 'Database',
    roles: ['admin', 'manager', 'owner'],
    children: [
      { key: 'nav.tester',          href: '/master/tester',      icon: 'FlaskConical' },
      { key: 'nav.positions',       href: '/master/positions',   icon: 'Briefcase'    },
      { key: 'nav.patients',        href: '/master/patients',    icon: 'Users'        },
      { key: 'nav.services',        href: '/master/services',    icon: 'Stethoscope'  },
      { key: 'nav.shift_hours',     href: '/master/shifts',      icon: 'Clock'        },
      { key: 'nav.master_schedule', href: '/master/schedules',   icon: 'CalendarCog'  },
      { key: 'nav.territory',       href: '/master/territories', icon: 'MapPin'       },
      { key: 'nav.users',           href: '/master/users',       icon: 'UserCog'      },
    ],
  },
  {
    key: 'nav.leave',
    href: '/leave',
    icon: 'CalendarOff',
  },
  {
    key: 'nav.targets',
    href: '/targets',
    icon: 'Target',
  },
  {
    key: 'nav.schedule',
    icon: 'CalendarDays',
    children: [
      { key: 'nav.schedule_list',     href: '/schedules',          icon: 'TableProperties' },
      { key: 'nav.schedule_calendar', href: '/schedules/calendar', icon: 'Calendar'        },
      { key: 'nav.schedule_today',    href: '/schedules/today',    icon: 'CalendarCheck'   },
    ],
  },
  {
    key: 'nav.reports',
    icon: 'BarChart3',
    children: [
      { key: 'nav.statistics',    href: '/reports',         icon: 'TrendingUp' },
      { key: 'nav.daily_report',  href: '/reports/daily',   icon: 'FileText'   },
      { key: 'nav.target_report', href: '/reports/targets', icon: 'Goal'       },
    ],
  },
  {
    key: 'nav.settings',
    icon: 'Settings',
    roles: ['admin', 'manager', 'owner'],
    children: [
      { key: 'nav.references',    href: '/settings/references',   icon: 'BookOpen'    },
      { key: 'nav.roles',         href: '/settings/roles',        icon: 'ShieldCheck' },
      { key: 'nav.permissions',   href: '/settings/permissions',  icon: 'Lock'        },
      { key: 'nav.configuration', href: '/settings/configuration',icon: 'Cog'         },
    ],
  },
]
