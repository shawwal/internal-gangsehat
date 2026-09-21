import type { NavItem } from '@/config/navigation'
import type { UserRole } from '@/types'

export const GRIYA_THERAPIST_HOME = '/griya-anak/dashboard'

// Nav keys a therapist of a Griya Anak-enabled branch may see/reach. Everything
// else (clinic patients, home visit, rekam medis, jadwal harian, ...) is unrelated
// to their work and is hidden and blocked.
const GRIYA_THERAPIST_NAV_KEYS = new Set([
  'griya-dashboard',
  'griya-jadwal',
  'griya-jadwal-master',
  'griya-jadwal-mingguan',
  'griya-siswa',
  'griya-siswa-saya',
  'my-leave',
  'target-progress',
  'notifications',
  'settings',
])

const ALWAYS_ALLOWED_PREFIXES = ['/api', '/auth', '/unauthorized', '/pending']

export function isGriyaTherapist(role: string | null | undefined, griyaEnabled: boolean): boolean {
  return role === 'therapist' && griyaEnabled
}

export function filterNavKeysForGriyaTherapist(keys: string[]): string[] {
  return keys.filter((k) => GRIYA_THERAPIST_NAV_KEYS.has(k))
}

export function isPathAllowedForGriyaTherapist(pathname: string, nav: NavItem[]): boolean {
  if (ALWAYS_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  return nav.some(
    (i) =>
      i.href &&
      GRIYA_THERAPIST_NAV_KEYS.has(i.key) &&
      i.roles.includes('therapist' as UserRole) &&
      (pathname === i.href || pathname.startsWith(i.href + '/')),
  )
}
