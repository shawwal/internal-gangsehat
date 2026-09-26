import type { MyStudent } from '@/app/actions/griyaMyStudents'

export type StatusFilter = 'all' | MyStudent['status']
export type SortKey = 'name' | 'last' | 'sessions' | 'next'

export const PAGE_SIZE = 12

export const STATUS_LABEL: Record<MyStudent['status'], string> = { active: 'Aktif', graduated: 'Lulus', inactive: 'Nonaktif' }
export const STATUS_CLS: Record<MyStudent['status'], string> = {
  active: 'bg-[#34C759]/15 text-[#34C759]',
  graduated: 'bg-primary/15 text-primary',
  inactive: 'bg-muted text-muted-foreground',
}
export const SORT_LABEL: Record<SortKey, string> = {
  name: 'Nama A–Z',
  last: 'Terakhir hadir',
  sessions: 'Sesi terbanyak',
  next: 'Jadwal terdekat',
}

export const chipCls = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer ${
    active ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
  }`

export const inputCls =
  'px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

export function fmtDate(iso: string | null, withYear = true) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function relDays(iso: string | null, today: string) {
  if (!iso) return null
  const diff = Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
  if (diff === 0) return 'hari ini'
  if (diff === 1) return 'besok'
  if (diff === -1) return 'kemarin'
  return diff > 0 ? `${diff} hari lagi` : `${-diff} hari lalu`
}
