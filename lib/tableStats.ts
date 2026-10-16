// Footer rows ("Jumlah" / "Rata-rata") for numeric tables.

export function sumOf(values: number[]): number {
  return values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
}

export function avgOf(values: number[]): number {
  return values.length ? sumOf(values) / values.length : 0
}

/** id-ID number with at most `digits` decimals: 12,5 · 1.234 · 0 */
export function formatStat(n: number, digits = 1): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(n)
}

/** Whether a bigger number is good ('higher': visits, hadir) or bad ('lower': terlambat, alfa, denda). */
export type StatDirection = 'higher' | 'lower'

/** Cell style for a value on the wrong side of its column's Rata-rata. */
export const BELOW_AVG_CLS = '!bg-destructive !text-white'

/**
 * Returns a test for "worse than the column average": below it for 'higher'
 * columns, above it for 'lower' columns. Pass the same values the Rata-rata
 * row averages. Never flags anything when every value is equal.
 */
export function belowAvgTest(values: number[], direction: StatDirection = 'higher'): (v: number) => boolean {
  const avg = avgOf(values)
  const spread = values.length > 1 && values.some((v) => v !== values[0])
  return (v) => spread && (direction === 'higher' ? v < avg : v > avg)
}
