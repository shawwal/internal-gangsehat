import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/pfotm-2026.json'
import { computeKpis, mergeMetrics, rankBoard, sanitizeMetricValue, scoreMetrics, type PointRule } from './engine'

// Expected totals/ranks come from the "Rekap Poin" sheet of
// reference/2.2 - Request Sistem Leaderboard Fisioterapis (Example).xlsx.
// Those months were scored with the sheet's weights (Alfa = +2), so the test
// scores them with that snapshot — exactly what the history import stores.

const sheetRules: PointRule[] = Object.entries(fixture.sheet_weights).map(([metric_key, weight]) => ({
  metric_key, metric_label: metric_key, weight, is_penalty: weight < 0,
}))

describe('PFOTM point engine', () => {
  for (const month of fixture.months) {
    it(`reproduces Rekap Poin totals for month ${month.month}`, () => {
      for (const e of month.entries) {
        expect(scoreMetrics(e.metrics, sheetRules).total, e.name).toBe(e.expected_total)
      }
    })

    it(`orders month ${month.month} consistently with the sheet's RANK()`, () => {
      const board = rankBoard(
        month.entries.map((e) => ({ key: e.name, name: e.name, metrics: e.metrics })),
        sheetRules,
        month.working_days,
      )
      // RANK() gives ties the same rank; our ordinal rank must fall inside the
      // tied block, i.e. between the sheet rank and sheet rank + tie size − 1.
      for (const row of board) {
        const e = month.entries.find((x) => x.name === row.name)!
        const tieSize = month.entries.filter((x) => x.expected_total === e.expected_total).length
        expect(row.rank).toBeGreaterThanOrEqual(e.expected_rank!)
        expect(row.rank).toBeLessThanOrEqual(e.expected_rank! + tieSize - 1)
      }
    })
  }

  it('crowns the same champions as "Daftar Pemenang"', () => {
    for (const month of fixture.months) {
      const board = rankBoard(
        month.entries.map((e) => ({ key: e.name, name: e.name, metrics: e.metrics })),
        sheetRules,
        month.working_days,
      )
      expect(board[0].name).toBe(fixture.champions[month.month - 1].champ)
    }
  })

  it('breaks ties on package sales, then late count, then discipline', () => {
    const rules: PointRule[] = [{ metric_key: 'hadir', metric_label: 'Hadir', weight: 1, is_penalty: false }]
    const board = rankBoard([
      { key: 'a', name: 'A', metrics: { hadir: 20, paket_1: 1, terlambat: 0 } },
      { key: 'b', name: 'B', metrics: { hadir: 20, paket_1: 2, terlambat: 3 } },
      { key: 'c', name: 'C', metrics: { hadir: 20, paket_1: 1, terlambat: 1 } },
    ], rules, 23)
    expect(board.map((r) => r.name)).toEqual(['B', 'A', 'C'])
    expect(board[1].tiedOnPoints).toBe(true)
  })

  it('computes the Rekap Data KPIs', () => {
    const k = computeKpis({ hadir: 25, terlambat: 1, kunjungan: 91, paket_1: 8, paket_2: 2 }, 25)
    expect(k.kehadiran).toBe(1)
    expect(k.disiplin).toBeCloseTo(0.96)
    expect(k.kunjungan_per_hadir).toBeCloseTo(3.64)
    expect(k.paket_per_hadir).toBeCloseTo(0.4)
    expect(k.jumlah_paket).toBe(10)
  })

  it('lets HR overrides win over auto metrics', () => {
    expect(mergeMetrics({ hadir: 20, kunjungan: 50 }, { kunjungan: 55 })).toEqual({ hadir: 20, kunjungan: 55 })
  })

  it('accepts only non-negative integers', () => {
    expect(sanitizeMetricValue('4')).toBe(4)
    expect(sanitizeMetricValue(-1)).toBeNull()
    expect(sanitizeMetricValue(1.5)).toBeNull()
    expect(sanitizeMetricValue('')).toBeNull()
  })
})
