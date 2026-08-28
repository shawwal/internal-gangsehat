export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

export function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n)
}

// Compact form for tight spots (KPI cards, chart axes): "Rp 222,3 jt", "Rp 1,7 M".
// Bounded width regardless of how many digits the real figure has.
export function formatRpCompact(n: number) {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const fmt = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  if (abs >= 1_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000)} M`
  if (abs >= 1_000_000) return `${sign}Rp ${fmt(abs / 1_000_000)} jt`
  if (abs >= 1_000) return `${sign}Rp ${fmt(abs / 1_000)} rb`
  return `${sign}Rp ${fmt(abs)}`
}
