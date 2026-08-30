/**
 * Import the "PASIEN" sheet of public/FT-KLINIK GRIYA ANAK.xlsx into the
 * `patients` table as Griya Anak children.
 *
 * Why a dedicated script and not /import/patients-v2:
 *  - the built-in importer de-dupes on phone_hash, but ~35 phone numbers in
 *    this sheet are shared by siblings — it would silently drop one child of
 *    every pair. This script de-dupes on (normalised name + birth date)
 *    instead, both within the file and against existing rows.
 *  - the "PASIEN" header is "Nama Anak" / "Tgl. Lahir" / "Jens Kelamin" which
 *    the built-in importer's alias list doesn't recognise.
 *
 * `patients` has no branch_id (shared table). A child becomes a Griya Anak
 * "student" operationally once they get a griya_schedule_slots row on
 * /griya-anak/jadwal — this script only creates the patient identity.
 *
 * DRY RUN by default. Pass --apply to write.
 *   npx tsx data_migrations/import-griya-anak-students.ts [--apply]
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { normalizeSumber } from '../lib/griyaSumber'

// ── env ──────────────────────────────────────────────────────────────────────
for (const envFile of ['../.env', '../.env.local']) {
  const p = path.join(__dirname, envFile)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const XLSX_PATH = path.join(__dirname, '../public/FT-KLINIK GRIYA ANAK.xlsx')
const SHEET = 'PASIEN'
const JUNK = new Set(['OFF', 'TA', 'SYS', 'ISTIRAHAT', 'MANAJEMEN', 'TEST', 'DUMMY'])

// ── crypto (mirrors lib/encryption.ts) ───────────────────────────────────────
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const c = crypto.createCipheriv('aes-256-gcm', encKey, iv)
  let e = c.update(text, 'utf8', 'hex'); e += c.final('hex')
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${e}`
}
function decrypt(enc: string | null): string {
  if (!enc) return ''
  const parts = enc.split(':')
  if (parts.length !== 3) return enc
  try {
    const iv = Buffer.from(parts[0], 'hex'), tag = Buffer.from(parts[1], 'hex')
    if (iv.length !== 16 || tag.length !== 16) return enc
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, iv)
    d.setAuthTag(tag)
    let r = d.update(parts[2], 'hex', 'utf8'); r += d.final('utf8')
    return r
  } catch { return enc }
}
function hashPhone(phone: string): string {
  const n = String(phone).replace(/[\s\-().+]/g, '').replace(/^0/, '62')
  return crypto.createHash('sha256').update(n).digest('hex')
}
function normName(s: string): string { return String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ') }
function titleCase(s: string): string {
  return s.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}
function dateToIso(v: unknown): string | null {
  // DOB cells are Excel serial numbers — parse with SSF (no timezone involved).
  if (typeof v === 'number' && v > 0) {
    const p = XLSX.SSF.parse_date_code(v)
    if (!p || !p.y || p.y < 1990 || p.y > 2026) return null
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear()
    if (y < 1990 || y > 2026) return null
    return `${y}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    let d = +dmy[1], mo = +dmy[2]
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]   // tolerate M/D/Y
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    return `${dmy[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}
function normAgama(raw: string): string | null {
  const v = raw.trim().toUpperCase()
  if (!v) return null
  if (v === 'PROTESTAN' || v === 'KRISTEN' || v.includes('PROTESTAN')) return 'KRISTEN PROTESTAN'
  if (v === 'KATOLIK' || v.includes('KATOLIK')) return 'KRISTEN KATOLIK'
  if (v.startsWith('BUD')) return 'BUDHA'
  if (v.startsWith('KHONG') || v.startsWith('KONG')) return 'KONGHUCU'
  if (v.startsWith('ISLAM')) return 'ISLAM'
  if (v.startsWith('HINDU')) return 'HINDU'
  return 'LAINNYA'
}
function normGender(raw: string): 'male' | 'female' | 'other' {
  const v = raw.trim().toLowerCase()
  if (v.startsWith('l') || v === 'male' || v === 'm') return 'male'
  if (v.startsWith('p') || v === 'female' || v === 'f') return 'female'
  return 'other'
}
function cleanPhone(raw: unknown): string {
  let s = String(raw ?? '').trim()
  if (!s || s === '-') return ''
  s = s.split(/[/,;]/)[0].trim().replace(/[\s().-]/g, '')
  if (/^\d+$/.test(s) && s.startsWith('8')) s = '0' + s
  return s
}

// ── parse sheet ──────────────────────────────────────────────────────────────
const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { cellDates: false })
const ws = wb.Sheets[SHEET]
if (!ws) { console.error(`Sheet "${SHEET}" not found. Sheets:`, wb.SheetNames); process.exit(1) }
const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
const header = (grid[0] as unknown[]).map((h) => String(h ?? '').trim())
const col = (name: string) => header.indexOf(name)

const IDX = {
  name: col('Nama Anak'),
  rm: col('No. RM'),
  dob: col('Tgl. Lahir'),
  gender: col('Jens Kelamin'),
  keluhan: col('Keluhan'),
  agama: col('Agama'),
  ibu: col('Nama Ibu'),
  pekIbu: col('Pekerjaan Ibu'),
  ayah: col('Nama Ayah'),
  pekAyah: col('Pekerjaan Ayah'),
  alamat: col('Alamat'),
  kelurahan: col('Kelurahan/Desa'),
  kecamatan: col('Kecamatan'),
  kabkota: col('Kabupaten/Kota'),
  provinsi: col('Provinsi'),
  phone: col('No. HP/WA'),
  sumber: col('Sumber'),
}
if (IDX.name < 0) { console.error('Column "Nama Anak" not found. Header:', header); process.exit(1) }

interface Rec {
  key: string
  name: string
  phone: string
  dob: string | null
  gender: 'male' | 'female' | 'other'
  agama: string | null
  address: string | null
  kelurahan: string | null
  kecamatan: string | null
  kabupaten_kota: string | null
  provinsi: string | null
  keluhan: string | null
  nama_ibu: string | null
  pekerjaan_ibu: string | null
  nama_ayah: string | null
  pekerjaan_ayah: string | null
  sumber: string | null
  sourceRow: number
}

const str = (r: unknown[], i: number) => (i < 0 || r[i] == null ? '' : String(r[i]).trim())

const recs: Rec[] = []
const fileSeen = new Set<string>()
let junk = 0, dupInFile = 0

for (let i = 1; i < grid.length; i++) {
  const r = grid[i] as unknown[]
  if (!r) continue
  const rawName = str(r, IDX.name)
  if (!rawName || rawName.startsWith('#') || JUNK.has(rawName.toUpperCase())) { if (rawName) junk++; continue }

  const dob = dateToIso(r[IDX.dob])
  const key = `${normName(rawName)}|${dob ?? ''}`
  if (fileSeen.has(key)) { dupInFile++; continue }
  fileSeen.add(key)

  const ibu = str(r, IDX.ibu), pekIbu = str(r, IDX.pekIbu)
  const ayah = str(r, IDX.ayah), pekAyah = str(r, IDX.pekAyah)

  recs.push({
    key,
    name: titleCase(rawName),
    phone: cleanPhone(r[IDX.phone]),
    dob,
    gender: normGender(str(r, IDX.gender)),
    agama: normAgama(str(r, IDX.agama)),
    address: str(r, IDX.alamat) || null,
    kelurahan: str(r, IDX.kelurahan) || null,
    kecamatan: str(r, IDX.kecamatan) || null,
    kabupaten_kota: str(r, IDX.kabkota) || null,
    provinsi: str(r, IDX.provinsi) || null,
    keluhan: str(r, IDX.keluhan) || null,
    nama_ibu: ibu ? titleCase(ibu) : null,
    pekerjaan_ibu: pekIbu ? pekIbu.toUpperCase() : null,
    nama_ayah: ayah ? titleCase(ayah) : null,
    pekerjaan_ayah: pekAyah ? pekAyah.toUpperCase() : null,
    sumber: normalizeSumber(str(r, IDX.sumber)),
    sourceRow: i + 1,
  })
}

// ── de-dupe against existing patients ────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main() {
  console.log(`Parsed ${recs.length} unique children  (junk rows: ${junk}, in-file dupes: ${dupInFile})`)

  const existingById = new Map<string, string>()   // name|dob  -> patient id
  const existingHashes = new Set<string>()
  let from = 0
  const PAGE = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, encrypted_name, encrypted_birth_date, phone_hash')
      .range(from, from + PAGE - 1)
    if (error) { console.error('fetch existing failed:', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    for (const p of data) {
      const nm = normName(decrypt(p.encrypted_name))
      const bd = p.encrypted_birth_date ? decrypt(p.encrypted_birth_date).slice(0, 10) : ''
      if (nm && !existingById.has(`${nm}|${bd}`)) existingById.set(`${nm}|${bd}`, p.id as string)
      if (p.phone_hash) existingHashes.add(p.phone_hash as string)
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`Existing patients: ${existingById.size} name+dob keys, ${existingHashes.size} phone hashes`)

  const toInsert = recs.filter((r) => !existingById.has(r.key))
  const toUpdate = recs.filter((r) => existingById.has(r.key))
  const noPhone = toInsert.filter((r) => !r.phone).length
  console.log(`\nWill INSERT ${toInsert.length} new  (${noPhone} without a phone)`)
  console.log(`Will UPDATE ${toUpdate.length} existing (backfill parent + sumber + demographics)\n`)
  console.log('Insert sample:')
  for (const r of toInsert.slice(0, 8)) {
    console.log(`  ${r.name}  dob=${r.dob ?? '—'}  ${r.gender}  ph=${r.phone || '—'}  ${r.kabupaten_kota ?? ''}  sumber=${r.sumber ?? '—'}`)
  }

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to write.'); return }

  const { data: branch } = await supabase
    .from('branches').select('id').ilike('name', '%Griya Anak%').eq('is_active', true).limit(1).maybeSingle()
  const griyaBranchId = branch?.id ?? null
  if (!griyaBranchId) console.warn('WARN: Griya Anak branch not found — roster rows will be skipped.')

  // Only overwrite a demographic column when the sheet actually has a value.
  const demo = (r: Rec) => {
    const p: Record<string, unknown> = {
      nama_ibu: r.nama_ibu, pekerjaan_ibu: r.pekerjaan_ibu,
      nama_ayah: r.nama_ayah, pekerjaan_ayah: r.pekerjaan_ayah,
      sumber: r.sumber,
    }
    if (r.agama) p.agama = r.agama
    if (r.address) p.encrypted_address = encrypt(r.address)
    if (r.kelurahan) p.kelurahan = r.kelurahan
    if (r.kecamatan) p.kecamatan = r.kecamatan
    if (r.kabupaten_kota) p.kabupaten_kota = r.kabupaten_kota
    if (r.provinsi) p.provinsi = r.provinsi
    if (r.keluhan) p.keluhan = r.keluhan
    return p
  }

  // ── UPDATE existing ────────────────────────────────────────────────────────
  let uOk = 0, uFail = 0
  for (const r of toUpdate) {
    const id = existingById.get(r.key)!
    const { error } = await supabase.from('patients').update(demo(r)).eq('id', id)
    if (error) { uFail++; console.error(`  UPD FAIL ${r.name}: ${error.message}`); continue }
    uOk++
    if (griyaBranchId) {
      await supabase.from('griya_students')
        .upsert({ patient_id: id, branch_id: griyaBranchId, source: 'excel-import' },
          { onConflict: 'patient_id', ignoreDuplicates: true })
    }
    if ((uOk + uFail) % 200 === 0) console.log(`  upd ...${uOk + uFail}/${toUpdate.length}`)
  }
  console.log(`Updated ${uOk}, failed ${uFail}.`)

  // ── INSERT new ─────────────────────────────────────────────────────────────
  // phone_hash has a UNIQUE index, but siblings share a parent's number — keep
  // the real (encrypted) phone, drop the hash for the 2nd+ child on a number.
  const usedHashes = new Set<string>()
  let ok = 0, fail = 0
  for (const r of toInsert) {
    const h = r.phone ? hashPhone(r.phone) : null
    const phoneHash = h && !usedHashes.has(h) && !existingHashes.has(h) ? h : null
    if (phoneHash) usedHashes.add(phoneHash)

    const { data: inserted, error } = await supabase.from('patients').insert({
      encrypted_name: encrypt(r.name),
      encrypted_phone: encrypt(r.phone || '-'),
      encrypted_address: r.address ? encrypt(r.address) : null,
      encrypted_birth_date: r.dob ? encrypt(r.dob) : null,
      gender: r.gender,
      phone_hash: phoneHash,
      name_normalized: r.name.trim().toLowerCase(),
      agama: r.agama,
      kelurahan: r.kelurahan,
      kecamatan: r.kecamatan,
      kabupaten_kota: r.kabupaten_kota,
      provinsi: r.provinsi,
      keluhan: r.keluhan,
      nama_ibu: r.nama_ibu,
      pekerjaan_ibu: r.pekerjaan_ibu,
      nama_ayah: r.nama_ayah,
      pekerjaan_ayah: r.pekerjaan_ayah,
      sumber: r.sumber,
      is_active: true,
    }).select('id').single()
    if (error || !inserted) { fail++; console.error(`  FAIL ${r.name}: ${error?.message}`); continue }
    ok++

    if (griyaBranchId) {
      const { error: e2 } = await supabase.from('griya_students').insert({
        patient_id: inserted.id, branch_id: griyaBranchId, source: 'excel-import',
      })
      if (e2) console.warn(`  roster WARN ${r.name}: ${e2.message}`)
    }
    if ((ok + fail) % 100 === 0) console.log(`  ins ...${ok + fail}/${toInsert.length}`)
  }
  console.log(`\nDone. Inserted ${ok} (failed ${fail}), updated ${uOk} (failed ${uFail}).`)
}

main()
