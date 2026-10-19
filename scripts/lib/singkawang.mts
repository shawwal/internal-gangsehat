/**
 * Shared helpers for the Singkawang FISIOTERAPI.xlsx imports
 * (import-patients-singkawang.mts, import-singkawang-history.mts).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBirthDate } from '../../lib/dates'

export { XLSX }

export const SINGKAWANG_BRANCH_ID = 'b44b322b-07e1-4d00-a118-47c34eefb7c6'

export const __dirname = dirname(fileURLToPath(import.meta.url))
export const DRY_RUN = process.argv.includes('--dry-run')

// ── Load env ─────────────────────────────────────────────────────────────────
export const envRaw = readFileSync(join(__dirname, '../../.env.local'), 'utf8')
export const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

export const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']  ?? ''
export const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
export const ENCRYPTION_KEY   = env['ENCRYPTION_KEY']            ?? ''

// FISIO_XLSX=/path/to/FISIOTERAPI.xlsx overrides the default repo-root location
export const XLSX_PATH = process.env.FISIO_XLSX ?? join(__dirname, '../../FISIOTERAPI.xlsx')

export const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

// ── Encrypt / hash helpers (matches lib/encryption.ts) ────────────────────────
export function encrypt(text: string): string {
  const iv     = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', encKey, iv)
  const enc    = cipher.update(text, 'utf8', 'hex') + cipher.final('hex')
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`
}

export function decryptOrNull(text: string | null): string | null {
  const parts = (text ?? '').split(':')
  if (parts.length !== 3) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', encKey, Buffer.from(parts[0], 'hex'))
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'))
    return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

export function hashPhone(phone: string): string {
  const norm = phone.replace(/[\s\-\(\)\.\+]/g, '').replace(/^0/, '62')
  return createHash('sha256').update(norm).digest('hex')
}

// ── Field normalizers ────────────────────────────────────────────────────────
export function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

export function nullify(v: unknown): string | null {
  const t = str(v)
  return t === '' ? null : t
}

export function normalizeName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ')
}

// Sheets strips the leading 0 (stores 8xx as a number) and can show it as 8.9E+11.
export function normalizePhone(v: unknown): string {
  let s = typeof v === 'number' ? String(Math.round(v)) : str(v)
  s = s.replace(/[\s\-\(\)\.\+]/g, '')
  if (/^8/.test(s)) s = '0' + s
  return s.length >= 9 ? s : '' // "0" / "08" placeholders → no phone
}

export function normalizeGender(raw: string): 'male' | 'female' | 'other' {
  const v = raw.trim().toUpperCase()
  if (['L', 'LAKI-LAKI', 'LAKI LAKI'].includes(v)) return 'male'
  if (['P', 'PEREMPUAN'].includes(v)) return 'female'
  return 'other'
}

export const AGAMA_MAP: Record<string, string> = {
  ISLAM: 'ISLAM',
  KHONGHUCU: 'KONGHUCU',
  KONGHUCU: 'KONGHUCU',
  BUDDHA: 'BUDHA',
  BUDHA: 'BUDHA',
  KATOLIK: 'KRISTEN KATOLIK',
  'KRISTEN KATOLIK': 'KRISTEN KATOLIK',
  PROTESTAN: 'KRISTEN PROTESTAN',
  KRISTEN: 'KRISTEN PROTESTAN',
  'KRISTEN PROTESTAN': 'KRISTEN PROTESTAN',
  HINDU: 'HINDU',
  LAINNYA: 'LAINNYA',
}

export function normalizeAgama(raw: string): string | null {
  const v = raw.trim().toUpperCase()
  if (!v) return null
  return AGAMA_MAP[v] ?? 'LAINNYA'
}

export const CURRENT_YEAR = new Date().getFullYear()
export const CURRENT_YY   = CURRENT_YEAR % 100

// Birth dates are M/D/YY strings, or date serials when the cell is typed as a date.
export function parseBirthDate(v: unknown): string | null {
  let y: number, mo: number, d: number
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v)
    if (!p) return null
    ;({ y, m: mo, d } = p)
  } else {
    const m = str(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
    if (!m) return null
    mo = +m[1]; d = +m[2]; y = +m[3]
    if (m[3].length === 2) y += y > CURRENT_YY ? 1900 : 2000
  }
  if (y > CURRENT_YEAR) y -= 100 // 2-digit year auto-expanded into the future
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── Name matching ────────────────────────────────────────────────────────────
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/(\s\d+)+$/, '') // "abdul rahim 7107" → "abdul rahim"
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

// Equal or ≤2 typos = same person. One name containing the other ("AVRIL" / "avril capricia")
// only counts when birth dates don't disagree — "BAYU MARTIN" / "M. ZAKI BAYU MARTIN" are father/son.
export function namesMatch(a: string, b: string, dobA: string | null, dobB: string | null): boolean {
  const x = nameKey(a)
  const y = nameKey(b)
  if (!x || !y) return false
  if (x === y || levenshtein(x, y) <= 2) return true
  const contained = ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `)
  return contained && (!dobA || !dobB || dobA === dobB)
}

export type RosterPatient = {
  rowNo: number
  ts: number
  name: string
  no_rm: string
  age: number | null
  birthDate: string | null
  gender: 'male' | 'female' | 'other'
  address: string | null
  agama: string | null
  pekerjaan: string | null
  keluhan: string | null
  hobi: string | null
  phone: string
  hash: string | null
  regio: string | null
}

export function createAdmin() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
    console.error('❌ Missing env vars in .env.local')
    process.exit(1)
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

export function readSheet(name: string): unknown[][] {
  const wb = XLSX.read(readFileSync(XLSX_PATH))
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Sheet "${name}" not found`)
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
}

/** Excel date serial → YYYY-MM-DD (null for blanks / text). */
export function serialToDate(v: unknown): string | null {
  if (typeof v !== 'number' || v < 1) return null
  const p = XLSX.SSF.parse_date_code(v)
  if (!p) return null
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/**
 * DATA PASIEN roster, one entry per sheet row. Columns: 0 Timestamp, 1 NAMA, 2 NO. RM,
 * 3 USIA, 4 KATEGORI USIA, 5 TANGGAL LAHIR, 6 JENIS KELAMIN, 7 ALAMAT, 8 AGAMA,
 * 9 PEKERJAAN, 10 KELUHAN, 11 HOBI, 12 NO. HP, 13 DIAGNOSA, 14 REGIO
 */
export function readRoster(): RosterPatient[] {
  const rows = readSheet('DATA PASIEN')
  const out: RosterPatient[] = []
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i] ?? []
    const name  = normalizeName(str(c[1]))
    const no_rm = str(c[2]).toUpperCase()
    if (!name || !no_rm || ['OFF', 'LIBUR', 'TA'].includes(name)) continue

    const ageRaw = parseInt(str(c[3]), 10)
    const phone  = normalizePhone(c[12])
    out.push({
      rowNo:     i + 1,
      ts:        typeof c[0] === 'number' ? c[0] : 0,
      name,
      no_rm,
      age:       ageRaw > 0 && ageRaw < 120 ? ageRaw : null,
      birthDate: parseBirthDate(c[5]),
      gender:    normalizeGender(str(c[6])),
      address:   nullify(c[7]),
      agama:     normalizeAgama(str(c[8])),
      pekerjaan: nullify(c[9]),
      keluhan:   nullify(c[10]),
      hobi:      nullify(c[11]),
      phone,
      hash:      phone ? hashPhone(phone) : null,
      regio:     nullify(c[14])?.toUpperCase() ?? null,
    })
  }
  return out
}

export function anyDate(v: unknown): string | null {
  if (typeof v === 'number') return serialToDate(v)
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA')
}


export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

type DbPatient = {
  id: string
  no_rm: string | null
  phone_hash: string | null
  name_normalized: string | null
  encrypted_birth_date: string | null
}


/**
 * RM / name → patients.id for Singkawang sheets. Order: exact no_rm; a DATA PASIEN RM that
 * was merged into a twin row or matched an existing patient; a unique name in the roster
 * (exact, then fuzzy). `viaName` collects name-only matches for the report.
 */
export async function loadPatientResolver(supabase: SupabaseClient) {
  const dbPatients = await fetchAll<DbPatient>((f, t) => supabase.from('patients')
    .select('id, no_rm, phone_hash, name_normalized, encrypted_birth_date').order('id').range(f, t))
  const byRm = new Map<string, string>()
  const byHash = new Map<string, DbPatient[]>()
  for (const p of dbPatients) {
    if (p.no_rm) byRm.set(p.no_rm.toUpperCase(), p.id)
    if (p.phone_hash) byHash.set(p.phone_hash, [...(byHash.get(p.phone_hash) ?? []), p])
  }

  const roster = readRoster()
  const rosterByRm = new Map(roster.map(r => [r.no_rm, r]))
  const rosterIdCache = new Map<string, string | null>()

  // A roster RM that isn't in the DB was either merged into a twin row or matched an existing patient.
  function rosterId(rm: string): string | null {
    if (rosterIdCache.has(rm)) return rosterIdCache.get(rm)!
    const r = rosterByRm.get(rm)
    let id: string | null = byRm.get(rm) ?? null
    if (!id && r?.hash) {
      const db = (byHash.get(r.hash) ?? []).find(p =>
        namesMatch(p.name_normalized ?? '', r.name, normalizeBirthDate(decryptOrNull(p.encrypted_birth_date)), r.birthDate))
      id = db?.id ?? null
      if (!id) {
        const twin = roster.find(o => o !== r && o.hash === r.hash && byRm.has(o.no_rm)
          && namesMatch(o.name, r.name, o.birthDate, r.birthDate))
        id = twin ? byRm.get(twin.no_rm)! : null
      }
    }
    rosterIdCache.set(rm, id)
    return id
  }

  const viaName: string[] = []
  function resolvePatient(rmRaw: unknown, nameRaw: unknown): string | null {
    const rm = str(rmRaw).toUpperCase()
    const name = normalizeName(str(nameRaw))
    const direct = rm ? byRm.get(rm) ?? (rosterByRm.has(rm) ? rosterId(rm) : null) : null
    if (direct) return direct
    if (!name) return null
    // Unique name in the Singkawang roster — exact first, then fuzzy
    for (const exact of [true, false]) {
      const ids = new Set(roster
        .filter(r => exact ? nameKey(r.name) === nameKey(name) : namesMatch(r.name, name, null, null))
        .map(r => rosterId(r.no_rm)))
      ids.delete(null)
      if (ids.size === 1) {
        viaName.push(`${name} (sheet RM "${rm || '—'}")`)
        return [...ids][0]
      }
      if (ids.size > 1) return null
    }
    return null
  }

  return { dbCount: dbPatients.length, roster, rosterId, resolvePatient, viaName }
}
