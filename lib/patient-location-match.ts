import {
  PROVINSI,
  KABUPATEN_KOTA,
  getKabupatenByProvinsi,
  getKecamatanByKabupaten,
} from './indonesia-regions'

function normalize(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^(KABUPATEN|KOTA|KAB\.?)\s+/, '')
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev = new Array(n + 1)
  let curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

interface Named {
  nama: string
}

function bestMatch<T extends Named>(rawInput: string, candidates: T[]): { candidate: T; exact: boolean } | null {
  const input = rawInput.trim()
  if (!input || candidates.length === 0) return null

  const normInput = normalize(input)

  // exact match (raw or normalized, ignoring KABUPATEN/KOTA prefix)
  for (const c of candidates) {
    if (c.nama.trim().toUpperCase() === input.toUpperCase() || normalize(c.nama) === normInput) {
      return { candidate: c, exact: true }
    }
  }

  // fuzzy match — smallest edit distance relative to name length
  let best: { candidate: T; dist: number } | null = null
  for (const c of candidates) {
    const dist = levenshtein(normInput, normalize(c.nama))
    if (!best || dist < best.dist) best = { candidate: c, dist }
  }

  if (best) {
    const threshold = Math.max(2, Math.floor(normInput.length * 0.35))
    if (best.dist <= threshold) return { candidate: best.candidate, exact: false }
  }

  return null
}

export interface LocationMatchResult {
  provinsi: string
  provinsiMatched: boolean
  kabupatenKota: string
  kabupatenMatched: boolean
  kecamatan: string
  kecamatanMatched: boolean
}

/**
 * Resolve free-text provinsi/kabupaten/kecamatan from an Excel import against
 * the canonical region lists used by the create-patient location selector.
 * Falls back to the raw input (as a "custom value", same as RegionSelect
 * supports) whenever nothing close enough is found.
 */
export function matchLocation(
  rawProvinsi: string,
  rawKabupaten: string,
  rawKecamatan: string,
): LocationMatchResult {
  const provMatch = bestMatch(rawProvinsi, PROVINSI)
  let provinsi = provMatch?.candidate.nama ?? rawProvinsi.trim()
  let provinsiMatched = !!provMatch

  const provinsiKode = provMatch ? provMatch.candidate.kode : null
  const kabPool = provinsiKode ? getKabupatenByProvinsi(provinsiKode) : KABUPATEN_KOTA
  const kabMatch = bestMatch(rawKabupaten, kabPool)
  const kabupatenKota = kabMatch?.candidate.nama ?? rawKabupaten.trim()
  const kabupatenMatched = !!kabMatch

  // If provinsi text didn't resolve but the kabupaten did (searched nationally),
  // infer the province from the matched kabupaten.
  if (!provinsiMatched && kabMatch) {
    const inferred = PROVINSI.find((p) => p.kode === kabMatch.candidate.provinsi_kode)
    if (inferred) {
      provinsi = inferred.nama
      provinsiMatched = true
    }
  }

  const finalProvinsiKode = PROVINSI.find((p) => p.nama === provinsi)?.kode ?? provinsiKode
  const kabKode = kabMatch && kabMatch.candidate.provinsi_kode === finalProvinsiKode
    ? kabMatch.candidate.kode
    : (KABUPATEN_KOTA.find((k) => k.nama === kabupatenKota && k.provinsi_kode === finalProvinsiKode)?.kode ?? null)

  const kecPool = kabKode ? getKecamatanByKabupaten(kabKode) : []
  const kecMatch = kecPool.length ? bestMatch(rawKecamatan, kecPool) : null
  const kecamatan = kecMatch?.candidate.nama ?? rawKecamatan.trim()
  const kecamatanMatched = !!kecMatch

  return { provinsi, provinsiMatched, kabupatenKota, kabupatenMatched, kecamatan, kecamatanMatched }
}
