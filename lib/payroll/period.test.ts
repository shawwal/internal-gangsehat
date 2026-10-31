import { describe, expect, it } from 'vitest'
import { buildDaysInRange, buildPeriodDays } from './period'

describe('buildDaysInRange', () => {
  it('builds an explicit range (Nov payroll moved to 27 Okt – 25 Nov)', () => {
    const r = buildDaysInRange('2026-10-27', '2026-11-25', { weeklyOffDays: ['JUMAT'], holidays: [] })
    expect(r.days).toHaveLength(30)
    expect(r.days[0].date).toBe('2026-10-27')
    expect(r.days.at(-1)!.date).toBe('2026-11-25')
    expect(r.workdays).toBe(30 - r.days.filter((d) => !d.workday).length)
  })

  it('keeps day flags already set on dates still in range', () => {
    const base = buildPeriodDays(2026, 11, { startDay: 27, weeklyOffDays: [], holidays: [] })
    const edited = base.days.map((d) => (d.date === '2026-11-02' ? { ...d, workday: false, note: 'Cuti bersama' } : d))
    const r = buildDaysInRange('2026-10-27', '2026-11-25', { weeklyOffDays: [], holidays: [] }, edited)
    expect(r.days.find((d) => d.date === '2026-11-02')).toEqual({ date: '2026-11-02', workday: false, note: 'Cuti bersama' })
  })
})
