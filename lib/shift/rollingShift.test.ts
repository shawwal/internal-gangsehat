import { describe, it, expect } from 'vitest'
import { getShiftMinggu, getPeriodeKe, getPolaAktif, getShiftForDay, type ShiftPatternRow } from './rollingShift'

const polaX: ShiftPatternRow = {
  senin: 'PAGI', selasa: 'PAGI', rabu: 'SORE', kamis: 'SORE', jumat: 'PAGI', sabtu: 'SORE',
}
const polaY: ShiftPatternRow = {
  senin: 'SORE', selasa: 'SORE', rabu: 'PAGI', kamis: 'PAGI', jumat: 'SORE', sabtu: 'PAGI',
}

describe('getShiftMinggu', () => {
  it('Sabtu SORE -> Minggu PAGI', () => {
    expect(getShiftMinggu('SORE')).toBe('PAGI')
  })
  it('Sabtu PAGI -> Minggu SORE', () => {
    expect(getShiftMinggu('PAGI')).toBe('SORE')
  })
  it('Sabtu OFF -> passthrough fallback', () => {
    expect(getShiftMinggu('OFF')).toBe('OFF')
  })
})

describe('getPeriodeKe', () => {
  const anchor = new Date('2026-01-05T00:00:00') // a Monday = periode 1, week 1

  it('same week as anchor -> periode 1', () => {
    expect(getPeriodeKe(new Date('2026-01-05T00:00:00'), anchor)).toBe(1)
  })
  it('second week of periode 1 -> still periode 1', () => {
    expect(getPeriodeKe(new Date('2026-01-12T00:00:00'), anchor)).toBe(1)
  })
  it('crosses the 2-week boundary into periode 2', () => {
    expect(getPeriodeKe(new Date('2026-01-19T00:00:00'), anchor)).toBe(2)
  })
  it('periode 2 stays for its full 2 weeks', () => {
    expect(getPeriodeKe(new Date('2026-01-26T00:00:00'), anchor)).toBe(2)
  })
  it('crosses into periode 3', () => {
    expect(getPeriodeKe(new Date('2026-02-02T00:00:00'), anchor)).toBe(3)
  })
})

describe('getPolaAktif', () => {
  it('odd periode: Tim A = Pola X, Tim B = Pola Y', () => {
    expect(getPolaAktif('A', 1, polaX, polaY)).toBe(polaX)
    expect(getPolaAktif('B', 1, polaX, polaY)).toBe(polaY)
  })
  it('even periode: Tim A = Pola Y, Tim B = Pola X (full swap)', () => {
    expect(getPolaAktif('A', 2, polaX, polaY)).toBe(polaY)
    expect(getPolaAktif('B', 2, polaX, polaY)).toBe(polaX)
  })
  it('periode 3 swaps back to periode-1 assignment', () => {
    expect(getPolaAktif('A', 3, polaX, polaY)).toBe(polaX)
    expect(getPolaAktif('B', 3, polaX, polaY)).toBe(polaY)
  })
})

describe('getShiftForDay', () => {
  it('reads weekday shifts directly from the pattern', () => {
    expect(getShiftForDay(polaX, 'senin')).toBe('PAGI')
    expect(getShiftForDay(polaX, 'rabu')).toBe('SORE')
  })
  it('derives Minggu from Sabtu, never a stored value', () => {
    expect(getShiftForDay(polaX, 'minggu')).toBe('PAGI') // Sabtu=SORE -> Minggu=PAGI
    expect(getShiftForDay(polaY, 'minggu')).toBe('SORE') // Sabtu=PAGI -> Minggu=SORE
  })
})

describe('full rotation integration', () => {
  it('Tim A and Tim B never share the same pattern within a period, and fully invert across periods', () => {
    for (let periode = 1; periode <= 4; periode++) {
      const a = getPolaAktif('A', periode, polaX, polaY)
      const b = getPolaAktif('B', periode, polaX, polaY)
      expect(a).not.toBe(b)
    }
    // Odd periods and even periods are mirror images of each other
    expect(getPolaAktif('A', 1, polaX, polaY)).toBe(getPolaAktif('B', 2, polaX, polaY))
    expect(getPolaAktif('B', 1, polaX, polaY)).toBe(getPolaAktif('A', 2, polaX, polaY))
  })
})
