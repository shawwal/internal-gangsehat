// "Sumber" (how the family heard about the clinic) for Griya Anak children.
// Strict list — the Ubah Data form is a plain <select>. The Excel import and
// any stored legacy value are folded into one of these via normalizeSumber().
// Pure module (no imports) so data_migrations scripts can import it too.

export const SUMBER_OPTIONS = [
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'GOOGLE',
  'INFORMASI KERABAT',
  'REKOMENDASI DOKTER',
  'REKOMENDASI SEKOLAH',
  'PASIEN LAMA',
  'DATANG LANGSUNG',
  'EVENT',
  'LAINNYA',
] as const

export type Sumber = (typeof SUMBER_OPTIONS)[number]

const SUMBER_SET: Set<string> = new Set(SUMBER_OPTIONS)

/** Map a raw / legacy "sumber" string to exactly one SUMBER_OPTIONS value. */
export function normalizeSumber(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const u = s.toUpperCase()
  if (SUMBER_SET.has(u)) return u

  const has = (...needles: string[]) => needles.some((n) => u.includes(n))

  if (has('INSTAGRAM', ' IG', 'INSTA', 'SPONSOR DI APLIKASI')) return 'INSTAGRAM'
  if (has('FACEBOOK', ' FB')) return 'FACEBOOK'
  if (has('TIKTOK', 'THREADS')) return 'TIKTOK'
  if (has('GOOGLE', 'MAPS', 'BROWSING', 'SEARCH', 'SEACRCH', 'INTERNET', ' AI')) return 'GOOGLE'
  if (has('DOKTER', 'DSA', 'RUJUKAN', 'SP.A', 'SP. A', 'SPA', ' RS', 'RSUD', 'PSIKOLOG', 'PISIKOLOG', 'DR.', 'DR ', 'NEVITA', 'ROSYADI', 'LEA')) return 'REKOMENDASI DOKTER'
  if (has('SEMINAR', 'EVENT', 'OUTDOOR', 'GOES TO', 'MENGISI DI')) return 'EVENT'
  if (has('SEKOLAH', 'SCHOOL', 'SCHOLL', ' TK', 'TK ', 'LES', 'DAYCARE', 'DAY CARE', 'AHE', 'PAUD', 'GURU', 'MISS ', 'SUNSHINE', 'TUNAS BANGSA')) return 'REKOMENDASI SEKOLAH'
  if (has('PASIEN LAMA', 'SUDAH PERNAH TERAPI', 'PERNAH TERAPI', 'SUDAH PERNAH', 'PASIEN DI SITU', 'PASIEN SITU', 'TERAPI NAZWA')) return 'PASIEN LAMA'
  if (has('KERABAT', 'TEMAN', 'KAWAN', 'TETANGGA', 'KELUARGA', 'SAUDARA', 'ADEK SAYA', 'ADIK SAYA', 'BUNDA', 'MBA ', 'TANTE', 'OM ', 'ORANG DALAM', 'ORANG LAIN', 'REKOMENDASI', 'REKOMEDASI', 'INFORMASI', 'INFO ', 'BANG EDO')) return 'INFORMASI KERABAT'
  if (has('PLANG', 'PAS LEWAT', 'LEWAT', 'LANGSUNG DATANG', 'LANGSUNG', 'DATANG')) return 'DATANG LANGSUNG'

  return 'LAINNYA'
}
