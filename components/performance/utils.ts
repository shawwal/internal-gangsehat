export const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
export const CURRENT_YEAR = new Date().getFullYear()
export const CURRENT_MONTH = new Date().getMonth() + 1
export const YEARS = Array.from({ length: Math.max(CURRENT_YEAR - 2022, 1) }, (_, i) => CURRENT_YEAR - i)

// Clinics operate in Asia/Jakarta — compute "today" in that timezone explicitly
// rather than the machine's local clock, so a device set to a different
// timezone (or a server running in UTC) can't shift the day boundary and
// leak an extra day's unmarked visits into "attended" via the isAttended()
// past-date fallback below.
function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}
export const TODAY_ISO = todayISO()

export const PIE_COLORS = ['#FF0090', '#FFB35C', '#34C759']

// Service type groupers
export const TA_TYPES    = ['TERAPI AWAL', 'TA VISIT']   as const
export const PAKET_TYPES = ['PAKET TERAPI', 'PAKET VISIT'] as const
export const SESI_TYPES  = ['SESI TERAPI', 'SESI VISIT']  as const
export const VISIT_STATUS_FILTER = ['scheduled', 'completed'] as const

// Month-based weekly ranges (Data Studio style: wk1=1-7, wk2=8-14, wk3=15-21, wk4=22-end)
const WEEK_STARTS = [1, 8, 15, 22]
const WEEK_ENDS   = [7, 14, 21, 0] // 0 = last day of month

export function getWeekRangeInMonth(
  week: 1 | 2 | 3 | 4,
  month: number,
  year: number,
): { start: string; end: string; label: string } {
  const pm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDay = WEEK_STARTS[week - 1]
  const endDay = WEEK_ENDS[week - 1] || lastDay
  const sd = String(startDay).padStart(2, '0')
  const ed = String(endDay).padStart(2, '0')
  return {
    start: `${year}-${pm}-${sd}`,
    end:   `${year}-${pm}-${ed}`,
    label: `Minggu ${week} (${startDay}–${endDay} ${MONTHS[month - 1]})`,
  }
}

export function getMonthRange(month: number, year: number): { start: string; end: string } {
  const pm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${pm}-01`,
    end:   `${year}-${pm}-${lastDay}`,
  }
}

export function pctValue(actual: number, target: number): number | null {
  if (!target) return null
  return (actual / target) * 100
}

export function formatPct(actual: number, target: number): string {
  if (!target) return '—'
  return `${((actual / target) * 100).toFixed(1)}%`
}

export function progressColor(pct: number | null): string {
  if (pct === null) return 'var(--muted-foreground)'
  if (pct >= 100) return 'var(--chart-4)'
  if (pct >= 80)  return 'var(--secondary)'
  return 'var(--destructive)'
}

export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function classifyServiceType(serviceType: string | null): 'ta' | 'paket' | 'sesi' | 'lainnya' {
  if (!serviceType) return 'lainnya'
  if ((TA_TYPES as readonly string[]).includes(serviceType))    return 'ta'
  if ((PAKET_TYPES as readonly string[]).includes(serviceType)) return 'paket'
  if ((SESI_TYPES as readonly string[]).includes(serviceType))  return 'sesi'
  return 'lainnya'
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: '2-digit',
  })
}

// Attendance convention used across performance/target dashboards: past visits
// with no kehadiran recorded are assumed attended (staff often forgets to mark
// it after the fact), but a visit dated today or later must be explicitly
// confirmed HADIR — otherwise a freshly scheduled jadwal harian entry would
// count before it's actually happened.
export function isAttended(
  v: { kehadiran?: 'HADIR' | 'TIDAK HADIR' | null; visit_date: string },
  todayISO: string = TODAY_ISO,
): boolean {
  if (v.kehadiran === 'HADIR') return true
  if (v.kehadiran == null && v.visit_date < todayISO) return true
  return false
}

// Paket Klinik / Paket Visit are counted once per package — on the date of
// its earliest attended session — not once per session delivered, matching
// how the legacy dashboard tracks new package sales rather than session volume.
export function firstPackageVisits<T extends { package_id?: string | null; visit_date: string }>(
  paketVisits: T[],
): T[] {
  const firstByPackage = new Map<string, T>()
  const standalone: T[] = []
  for (const v of paketVisits) {
    if (v.package_id) {
      const existing = firstByPackage.get(v.package_id)
      if (!existing || v.visit_date < existing.visit_date) firstByPackage.set(v.package_id, v)
    } else {
      standalone.push(v)
    }
  }
  return [...firstByPackage.values(), ...standalone]
}
