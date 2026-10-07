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
