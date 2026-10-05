// PFOTM point engine (replaces the Data / Rank / Rekap sheets). Pure module.
//
// Total Points = Σ metric_i × weight_i   (weights come from pfotm_point_rules)
// Ranking: total points ↓, then package sales ↓, late incidents ↑,
//          discipline rate ↓, then name (so ranks are always unique ordinals).

export interface PointRule {
  metric_key: string
  metric_label: string
  weight: number
  is_penalty: boolean
  source?: 'auto' | 'manual'
  sort_order?: number
  is_active?: boolean
}

export type Metrics = Record<string, number>

export interface BoardInput {
  key: string            // staff id, or display name for imported rows
  name: string
  avatarUrl?: string | null
  metrics: Metrics
}

export interface Kpis {
  kehadiran: number              // hadir / hari kerja
  disiplin: number               // (hadir − terlambat) / hadir
  kunjungan_per_hadir: number
  paket_per_hadir: number
  jumlah_paket: number
}

export interface BoardRow extends BoardInput {
  breakdown: Record<string, number>
  total: number
  rank: number
  /** True when total points equal the row above (rank decided by tie-breakers). */
  tiedOnPoints: boolean
  kpis: Kpis
}

export const PACKAGE_KEYS = ['paket_1', 'paket_2', 'paket_3'] as const

const m = (metrics: Metrics, key: string) => Number(metrics[key] ?? 0)

export function computeKpis(metrics: Metrics, workingDays: number): Kpis {
  const hadir = m(metrics, 'hadir')
  const late = m(metrics, 'terlambat')
  const paket = PACKAGE_KEYS.reduce((s, k) => s + m(metrics, k), 0)
  return {
    kehadiran: workingDays > 0 ? hadir / workingDays : 0,
    disiplin: hadir > 0 ? Math.max(0, hadir - late) / hadir : 0,
    kunjungan_per_hadir: hadir > 0 ? m(metrics, 'kunjungan') / hadir : 0,
    paket_per_hadir: hadir > 0 ? paket / hadir : 0,
    jumlah_paket: paket,
  }
}

export function scoreMetrics(metrics: Metrics, rules: PointRule[]): { breakdown: Record<string, number>; total: number } {
  const breakdown: Record<string, number> = {}
  let total = 0
  for (const r of rules) {
    if (r.is_active === false) continue
    const pts = m(metrics, r.metric_key) * Number(r.weight)
    breakdown[r.metric_key] = pts
    total += pts
  }
  // Avoid -0 / float noise from fractional weights.
  return { breakdown, total: Math.round(total * 100) / 100 }
}

export function rankBoard(inputs: BoardInput[], rules: PointRule[], workingDays: number): BoardRow[] {
  const rows = inputs.map((inp) => {
    const { breakdown, total } = scoreMetrics(inp.metrics, rules)
    return { ...inp, breakdown, total, rank: 0, tiedOnPoints: false, kpis: computeKpis(inp.metrics, workingDays) }
  })
  rows.sort((a, b) =>
    b.total - a.total
    || b.kpis.jumlah_paket - a.kpis.jumlah_paket
    || m(a.metrics, 'terlambat') - m(b.metrics, 'terlambat')
    || b.kpis.disiplin - a.kpis.disiplin
    || a.name.localeCompare(b.name, 'id'),
  )
  rows.forEach((r, i) => {
    r.rank = i + 1
    r.tiedOnPoints = i > 0 && rows[i - 1].total === r.total
  })
  return rows
}

/** Final metrics for an entry: HR overrides win over auto-collected values. */
export function mergeMetrics(auto: Metrics, override: Metrics): Metrics {
  const out: Metrics = { ...auto }
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && v !== undefined && !Number.isNaN(Number(v))) out[k] = Number(v)
  }
  return out
}

/** Non-negative integer guard used by the input form and the server action. */
export function sanitizeMetricValue(raw: unknown): number | null {
  if (raw === '' || raw === null || raw === undefined) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null
  return n
}
