import { describe, expect, it } from 'vitest'
import { dividersFromSlots, hourInFilter, rangeInFilter, shiftForHour } from './shifts'

const slots = [
  { shift: 'PAGI', slot_time: '09:00' }, { shift: 'PAGI', slot_time: '10:00' },
  { shift: 'MIDDLE', slot_time: '12:00' }, { shift: 'MIDDLE', slot_time: '13:00' },
  { shift: 'SORE', slot_time: '15:00' }, { shift: 'SORE', slot_time: '19:00' },
]

describe('shifts', () => {
  it('derives dividers from slots (no Middle → null)', () => {
    expect(dividersFromSlots(slots)).toEqual({ middle: 12, sore: 15 })
    expect(dividersFromSlots(slots.filter((s) => s.shift !== 'MIDDLE'))).toEqual({ middle: null, sore: 15 })
    expect(dividersFromSlots(null)).toEqual({ middle: null, sore: 14 })
  })

  it('maps hours to PAGI / MIDDLE / SORE', () => {
    const d = { middle: 12, sore: 15 }
    expect([9, 11, 12, 14, 15, 20].map((h) => shiftForHour(h, d)))
      .toEqual(['PAGI', 'PAGI', 'MIDDLE', 'MIDDLE', 'SORE', 'SORE'])
    expect(shiftForHour(12, { middle: null, sore: 15 })).toBe('PAGI')
  })

  it('filters hours and working ranges per shift', () => {
    const d = { middle: 12, sore: 15 }
    expect(hourInFilter(11, 'pagi', d)).toBe(true)
    expect(hourInFilter(12, 'pagi', d)).toBe(false)
    expect(hourInFilter(13, 'middle', d)).toBe(true)
    expect(hourInFilter(15, 'middle', d)).toBe(false)
    expect(rangeInFilter(11, 18, 'middle', d)).toBe(true)
    expect(rangeInFilter(8, 12, 'middle', d)).toBe(false)
    expect(hourInFilter(13, 'middle', { middle: null, sore: 15 })).toBe(false)
  })
})
