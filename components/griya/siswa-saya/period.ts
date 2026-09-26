import type { MyStudent } from '@/app/actions/griyaMyStudents'
import { fmtDate } from './constants'

export type PeriodMode = 'month' | 'range' | 'all'
export interface Period { mode: PeriodMode; from: string; to: string }

/** Inclusive date bounds ('YYYY-MM-DD'); null = unbounded (all time). */
export type Bounds = { from: string; to: string } | null

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => new Date(s + 'T00:00:00')

export function monthBounds(today: string, offset = 0) {
  const d = parse(today)
  return {
    from: iso(new Date(d.getFullYear(), d.getMonth() + offset, 1)),
    to: iso(new Date(d.getFullYear(), d.getMonth() + offset + 1, 0)),
  }
}

export function addDays(day: string, n: number) {
  const d = parse(day)
  d.setDate(d.getDate() + n)
  return iso(d)
}

export function resolveBounds(p: Period, today: string): Bounds {
  if (p.mode === 'all' || !today) return null
  if (p.mode === 'month') return monthBounds(today)
  if (!p.from && !p.to) return null
  // Tolerate reversed input rather than showing an empty list.
  const [from, to] = p.from && p.to && p.from > p.to ? [p.to, p.from] : [p.from, p.to]
  return { from: from || '0000-01-01', to: to || '9999-12-31' }
}

export function periodLabel(p: Period, today: string): string {
  if (p.mode === 'all') return 'Semua waktu'
  if (p.mode === 'month') {
    return today ? parse(today).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Bulan ini'
  }
  const b = resolveBounds(p, today)
  if (!b) return 'Pilih rentang'
  if (!p.from || !p.to) return p.from ? `Sejak ${fmtDate(b.from)}` : `Hingga ${fmtDate(b.to)}`
  return `${fmtDate(b.from)} – ${fmtDate(b.to)}`
}

/** Short label used on cards ("Bulan ini", "Periode", "Total"). */
export function periodShort(mode: PeriodMode) {
  return mode === 'month' ? 'Bulan ini' : mode === 'range' ? 'Periode ini' : 'Total sesi'
}

export interface PeriodStats { sessions: number; missed: number; lastVisit: string | null; touched: boolean }

export function statsInPeriod(s: MyStudent, b: Bounds): PeriodStats {
  let sessions = 0, missed = 0, lastVisit: string | null = null, touched = false
  for (const v of s.visits) {
    if (b && (v.date < b.from || v.date > b.to)) continue
    touched = true
    if (v.attended) { sessions++; lastVisit = v.date }
    if (v.missed) missed++
  }
  return { sessions, missed, lastVisit, touched }
}

export const RANGE_PRESETS: { label: string; get: (today: string) => { from: string; to: string } }[] = [
  { label: '7 hari', get: (t) => ({ from: addDays(t, -6), to: t }) },
  { label: '30 hari', get: (t) => ({ from: addDays(t, -29), to: t }) },
  { label: 'Bulan lalu', get: (t) => monthBounds(t, -1) },
  { label: '3 bulan', get: (t) => ({ from: monthBounds(t, -2).from, to: t }) },
]
