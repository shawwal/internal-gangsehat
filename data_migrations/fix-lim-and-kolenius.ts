/**
 * One-off repair for two patients found by audit-all-packages.ts's "orphaned
 * orders" check:
 *
 *  - KOLENIUS KOLAI: never created as a patient at all. Simple case — create
 *    the patient, 1 package (TRX/2026/01/0053), and 3 standalone visits.
 *
 *  - LIM OI KHIUN ALS RIANA: also never created — but 3 of her 5 PAKET orders
 *    (TRX/2025/11/0332, TRX/2026/01/0075, TRX/2026/04/0429) were misattributed
 *    during an earlier migration pass to a different, real patient, "LIM OI
 *    SIP ALS ERNY" (confirmed distinct: different first name, alias, phone,
 *    No. RM — not a duplicate). ERNY's chart currently shows 15 sessions and
 *    3 transactions (Rp 1,900,000) that are actually Riana's. This script:
 *      1. Creates the Riana patient record.
 *      2. Re-parents those 3 packages + their 15 visits + 3 transactions from
 *         Erny's patient_id to Riana's. Nothing is deleted; only patient_id
 *         columns move. Erny's own 3 correctly-attributed packages are
 *         untouched.
 *      3. Creates Riana's 2 genuinely-missing packages (TRX/2025/11/0095,
 *         TRX/2025/10/0045) and 2 missing standalone TERAPI AWAL visits.
 *
 * Patient PII sourced from "DATA PASIEN 2026 - Pasien (1).csv" (richest
 * available source — address, birth date, agama, pekerjaan, etc.)
 *
 * Defaults to DRY RUN. Pass --apply to write.
 *
 *   npx tsx data_migrations/fix-lim-and-kolenius.ts            # dry run
 *   npx tsx data_migrations/fix-lim-and-kolenius.ts --apply    # writes
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

for (const envFile of ['../.env', '../.env.local']) {
  const envPath = path.join(__dirname, envFile)
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877'
const ERNY_PATIENT_ID = '289788fa-d6d8-46c5-9d42-5309f2cd6d8e'
const MISATTRIBUTED_KODES = ['TRX/2025/11/0332', 'TRX/2026/01/0075', 'TRX/2026/04/0429']

const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}
function hashPhone(phone: string): string {
  const normalized = phone.replace(/[\s\-().+]/g, '').replace(/^0/, '62')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

function parseDmyDash(dmy: string): string | null {
  if (!dmy) return null
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}
function parseDmySlash(dmy: string | null): string | null {
  if (!dmy) return null
  const [d, m, y] = dmy.split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}
function parseRp(s: string | undefined | null): number {
  if (!s) return 0
  const n = s.replace(/[^0-9]/g, '')
  return n ? parseInt(n, 10) : 0
}
function deriveShift(jam: string): 'PAGI' | 'SORE' {
  if (!jam || jam === '-') return 'PAGI'
  return parseInt(jam.split(':')[0], 10) < 12 ? 'PAGI' : 'SORE'
}
function deriveKehadiran(statusSesi: string): 'HADIR' | 'TIDAK HADIR' {
  return statusSesi === 'Tidak Hadir' ? 'TIDAK HADIR' : 'HADIR'
}
function deriveVisitServiceType(layanan: string): string {
  const u = layanan.toUpperCase()
  if (u.startsWith('PAKET')) return u.includes('VISIT') ? 'PAKET VISIT' : 'PAKET TERAPI'
  if (u === 'TERAPI AWAL') return 'TERAPI AWAL'
  if (u === 'TA VISIT')    return 'TA VISIT'
  if (u.includes('VISIT')) return 'SESI VISIT'
  return 'SESI TERAPI'
}
function deriveTotalSessions(layanan: string, sessionCount: number): number {
  const u = layanan.toUpperCase()
  if (u === 'PAKET 1' || u === 'PAKET SILVER') return 5
  if (u === 'PAKET 2' || u === 'PAKET GOLD')   return 10
  if (u === 'PAKET PLATINUM')                   return 20
  return Math.max(sessionCount, 1)
}
function deriveJenisPaket(layanan: string): 'P1' | 'P2' | null {
  const u = layanan.toUpperCase()
  if (u === 'PAKET 1' || u === 'PAKET SILVER') return 'P1'
  if (u === 'PAKET 2' || u === 'PAKET GOLD')   return 'P2'
  return null
}
function deriveStatus(status: string): 'active' | 'completed' {
  return (status === 'Proses' || status === 'Booking') ? 'active' : 'completed'
}
function deriveOperationalStatus(status: string): string {
  if (status === 'Proses')  return 'ON'
  if (status === 'Booking') return 'PENDING'
  return 'OFF'
}
function matchTherapist(fisioName: string, profiles: { id: string; full_name: string }[]): string | null {
  if (!fisioName || fisioName === '-') return null
  const upper = fisioName.trim().toUpperCase()
  for (const p of profiles) if (p.full_name.toUpperCase().split(/\s+/).some(w => w === upper)) return p.id
  for (const p of profiles) if (p.full_name.toUpperCase().split(/\s+/).some(w => w.startsWith(upper) && upper.length >= 3)) return p.id
  return null
}
function doneSessions(sessions: Session[]): Session[] {
  return (sessions ?? []).filter(
    s => s['NOMINAL BAYAR'] === 'Sudah Ditangani' || s.STATUS_SESI === 'Hadir' || s.STATUS_SESI === 'Tidak Hadir'
  )
}
const SERVICE_TO_CATEGORY: Record<string, string> = {
  'TERAPI AWAL': 'TA KLINIK', 'SESI TERAPI': 'SESI KLINIK', 'PAKET TERAPI': 'PAKET KLINIK',
  'TA VISIT': 'TA VISIT', 'SESI VISIT': 'SESI VISIT', 'PAKET VISIT': 'PAKET VISIT', 'LAINNYA': 'LAINNYA',
}

interface Session { PERTEMUAN: string; TANGGAL: string; JAM: string; FISIO: string; STATUS_SESI: string; 'NOMINAL BAYAR': string; KETERANGAN: string }
interface Order { KODE: string; PASIEN: string; LAYANAN: string; STATUS: string; 'DIBUAT TGL': string; HARGA: string; DISKON: string; 'TOTAL BAYAR': string; 'STATUS BAYAR': string; sessions: Session[] }

interface NewPatient {
  name: string; no_rm: string; phone: string; gender: 'male' | 'female' | null
  birth_date: string | null; address: string | null; kelurahan: string | null
  kecamatan: string | null; kabupaten_kota: string | null; provinsi: string | null
  agama: string | null; pekerjaan: string | null; hobi: string | null
}

/**
 * Minimal quoted-CSV line parser. XLSX.readFile on this .csv auto-detects
 * date-like cells (e.g. "05/03/1962") and mangles them into ambiguous
 * short forms (e.g. "5/3/62"), silently losing the century — confirmed by
 * comparing its output against the raw file text. Parsing the file as plain
 * text avoids that entirely.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { cur += c }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { fields.push(cur); cur = '' }
      else cur += c
    }
  }
  fields.push(cur)
  return fields
}

function loadCsvPatient(name: string): NewPatient {
  const text = fs.readFileSync(path.join(__dirname, 'DATA PASIEN 2026 - 🙎_♂️ Pasien (1).csv'), 'utf8')
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  const header = parseCsvLine(lines[1])
  const idx: Record<string, number> = {}
  header.forEach((h, i) => { if (h) idx[h] = i })
  const row = lines.slice(2).map(parseCsvLine).find(r => r[idx['Nama Pasien']]?.trim().toUpperCase() === name)
  if (!row) throw new Error(`CSV row not found for ${name}`)
  const genderRaw = row[idx['Jenis Kelamin']]?.toUpperCase()
  return {
    name,
    no_rm: row[idx['No. RM']] || '',
    phone: row[idx['No. WA']] || '',
    gender: genderRaw === 'LAKI-LAKI' ? 'male' : genderRaw === 'PEREMPUAN' ? 'female' : null,
    birth_date: parseDmySlash(row[idx['Tanggal Lahir']] || null),
    address: row[idx['Alamat']] || null,
    kelurahan: row[idx['Kel./Desa']] || null,
    kecamatan: row[idx['Kecamatan']] || null,
    kabupaten_kota: row[idx['Kab./Kota']] || null,
    provinsi: row[idx['Provinsi']] || null,
    agama: row[idx['Agama']] || null,
    pekerjaan: row[idx['Pekerjaan']] || null,
    hobi: row[idx['Hobi/Aktivitas Sehari-hari']] || null,
  }
}

const orders: Order[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'orders_with_sessions.json'), 'utf8'))
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function buildVisitRows(order: Order, patientId: string, packageId: string | null, profiles: { id: string; full_name: string }[]) {
  return doneSessions(order.sessions).map(s => {
    const visitDate = parseDmyDash(s.TANGGAL)!
    const keterangan = s.KETERANGAN?.trim()
    const isPaymentNote = /^Rp/.test(keterangan ?? '')
    return {
      patient_id: patientId, package_id: packageId, branch_id: BRANCH_ID,
      visit_date: visitDate, visit_time: s.JAM && s.JAM !== '-' ? s.JAM : null,
      shift: deriveShift(s.JAM), service_type: deriveVisitServiceType(order.LAYANAN),
      kehadiran: deriveKehadiran(s.STATUS_SESI), status: 'completed',
      attending_staff_id: matchTherapist(s.FISIO, profiles),
      notes: (!isPaymentNote && keterangan && keterangan !== '-') ? keterangan : null,
    }
  })
}

async function main() {
  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = (profilesData ?? []) as { id: string; full_name: string }[]

  const kolenius = loadCsvPatient('KOLENIUS KOLAI')
  const riana = loadCsvPatient('LIM OI KHIUN ALS RIANA')
  console.log('── Patients to create ──')
  console.log(JSON.stringify(kolenius, null, 2))
  console.log(JSON.stringify(riana, null, 2))

  let koleniusId = 'DRYRUN-KOLENIUS'
  let rianaId = 'DRYRUN-RIANA'

  if (APPLY) {
    // A shared household WA number (e.g. a companion booked right alongside them)
    // is real and common here — don't block patient creation on it. If the hash
    // is already taken by someone else, keep the phone on the record for display
    // but leave phone_hash NULL so the unique index isn't violated.
    async function phoneHashFor(phone: string, label: string): Promise<string | null> {
      const h = hashPhone(phone)
      const { data: existing } = await supabase.from('patients').select('id').eq('phone_hash', h).maybeSingle()
      if (existing) {
        console.log(`  NOTE: phone ${phone} already used by patient ${existing.id} — creating ${label} with phone_hash=null (shared household number)`)
        return null
      }
      return h
    }

    const koleniusPhoneHash = await phoneHashFor(kolenius.phone, 'KOLENIUS')
    const { data: k, error: kErr } = await supabase.from('patients').insert({
      encrypted_name: encrypt(kolenius.name), encrypted_phone: encrypt(kolenius.phone),
      encrypted_address: kolenius.address ? encrypt(kolenius.address) : null,
      encrypted_birth_date: kolenius.birth_date ? encrypt(kolenius.birth_date) : null,
      gender: kolenius.gender, phone_hash: koleniusPhoneHash,
      name_normalized: kolenius.name.trim().toLowerCase(), no_rm: kolenius.no_rm || null,
      pekerjaan: kolenius.pekerjaan, agama: kolenius.agama, hobi: kolenius.hobi,
      kelurahan: kolenius.kelurahan, kecamatan: kolenius.kecamatan,
      kabupaten_kota: kolenius.kabupaten_kota, provinsi: kolenius.provinsi,
    }).select('id').single()
    if (kErr || !k) throw new Error(`Create KOLENIUS failed: ${kErr?.message}`)
    koleniusId = k.id

    const rianaPhoneHash = await phoneHashFor(riana.phone, 'RIANA')
    const { data: r, error: rErr } = await supabase.from('patients').insert({
      encrypted_name: encrypt(riana.name), encrypted_phone: encrypt(riana.phone),
      encrypted_address: riana.address ? encrypt(riana.address) : null,
      encrypted_birth_date: riana.birth_date ? encrypt(riana.birth_date) : null,
      gender: riana.gender, phone_hash: rianaPhoneHash,
      name_normalized: riana.name.trim().toLowerCase(), no_rm: riana.no_rm || null,
      pekerjaan: riana.pekerjaan, agama: riana.agama, hobi: riana.hobi,
      kelurahan: riana.kelurahan, kecamatan: riana.kecamatan,
      kabupaten_kota: riana.kabupaten_kota, provinsi: riana.provinsi,
    }).select('id').single()
    if (rErr || !r) throw new Error(`Create RIANA failed: ${rErr?.message}`)
    rianaId = r.id
  }
  console.log(`\nkoleniusId=${koleniusId}  rianaId=${rianaId}`)

  // ── Re-parent the 3 misattributed packages from Erny to Riana ─────────────
  console.log('\n── Re-parenting misattributed packages (Erny → Riana) ──')
  const { data: misPkgs } = await supabase.from('patient_packages')
    .select('id, notes').in('notes', MISATTRIBUTED_KODES.map(k => `kode:${k}`))
  if (!misPkgs || misPkgs.length !== 3) throw new Error(`Expected 3 misattributed packages, found ${misPkgs?.length}`)
  const misPkgIds = misPkgs.map(p => p.id)

  const { data: misVisits } = await supabase.from('patient_visits').select('id, package_id').in('package_id', misPkgIds)
  const misVisitIds = (misVisits ?? []).map(v => v.id)
  const { data: misTx } = await supabase.from('transactions').select('id, visit_id, amount').in('visit_id', misVisitIds)

  console.log(`  ${misPkgs.length} packages, ${misVisitIds.length} visits, ${misTx?.length ?? 0} transactions to re-parent`)
  for (const p of misPkgs) console.log(`    package ${p.notes}`)

  if (APPLY) {
    const { error: e1 } = await supabase.from('patient_packages').update({ patient_id: rianaId }).in('id', misPkgIds)
    if (e1) throw new Error(`Re-parent packages failed: ${e1.message}`)
    const { error: e2 } = await supabase.from('patient_visits').update({ patient_id: rianaId }).in('id', misVisitIds)
    if (e2) throw new Error(`Re-parent visits failed: ${e2.message}`)
    if (misTx?.length) {
      const { error: e3 } = await supabase.from('transactions').update({ patient_id: rianaId }).in('id', misTx.map(t => t.id))
      if (e3) throw new Error(`Re-parent transactions failed: ${e3.message}`)
    }
    console.log('  Re-parented.')
  }

  // ── Riana's 2 missing PAKET packages ───────────────────────────────────────
  console.log("\n── Riana's missing packages ──")
  for (const kode of ['TRX/2025/11/0095', 'TRX/2025/10/0045']) {
    const order = orders.find(o => o.KODE === kode)!
    const rows = buildVisitRows(order, rianaId, null, profiles) // package_id filled after insert
    console.log(`  ${kode} (${order.LAYANAN}, ${order.STATUS}): ${rows.length} sessions`)
    if (!APPLY) continue
    const totalSessions = deriveTotalSessions(order.LAYANAN, doneSessions(order.sessions).length)
    const createdAt = parseDmyDash(order['DIBUAT TGL'])
    const { data: pkg, error: pkgErr } = await supabase.from('patient_packages').insert({
      patient_id: rianaId, branch_id: BRANCH_ID, package_name: order.LAYANAN, package_type: 'fixed',
      total_sessions: totalSessions, jenis_paket: deriveJenisPaket(order.LAYANAN), mulai_paket: 'NEW',
      operational_status: deriveOperationalStatus(order.STATUS), status: deriveStatus(order.STATUS),
      notes: `kode:${order.KODE}`, legacy_used_sessions: 0,
      ...(createdAt ? { created_at: createdAt } : {}),
    }).select('id').single()
    if (pkgErr || !pkg) { console.error(`    FAIL: ${pkgErr?.message}`); continue }
    const { error: visitErr } = await supabase.from('patient_visits').insert(rows.map(r => ({ ...r, package_id: pkg.id })))
    if (visitErr) console.error(`    FAIL visits: ${visitErr.message}`)
  }

  // ── Riana's 2 missing standalone TERAPI AWAL visits ────────────────────────
  console.log("\n── Riana's missing standalone visits ──")
  for (const kode of ['TRX/2026/04/0385', 'TRX/2026/01/0046']) {
    const order = orders.find(o => o.KODE === kode)!
    const rows = buildVisitRows(order, rianaId, null, profiles)
    console.log(`  ${kode} (${order.LAYANAN}): ${rows.length} visit(s), Rp${parseRp(order['TOTAL BAYAR'])}`)
    if (!APPLY || rows.length === 0) continue
    const { data: inserted, error } = await supabase.from('patient_visits').insert(rows).select('id, visit_date, service_type, attending_staff_id')
    if (error || !inserted) { console.error(`    FAIL: ${error?.message}`); continue }
    const amount = parseRp(order['TOTAL BAYAR'])
    if (amount > 0) {
      const target = inserted[inserted.length - 1]
      const { error: txErr } = await supabase.from('transactions').insert({
        visit_id: target.id, patient_id: rianaId, branch_id: BRANCH_ID,
        fisio_id: target.attending_staff_id, type: 'income',
        category: SERVICE_TO_CATEGORY[target.service_type ?? ''] ?? 'LAINNYA',
        harga: parseRp(order.HARGA), discount: parseRp(order.DISKON), amount,
        payment_method: null, payment_status: order['STATUS BAYAR'] === 'Lunas' ? 'LUNAS' : 'DP',
        penjamin: null, description: `Impor data historis (KODE: ${order.KODE})`,
        transaction_date: target.visit_date, status: 'confirmed', recorded_by: null,
      })
      if (txErr) console.error(`    FAIL tx: ${txErr.message}`)
    }
  }

  // ── Kolenius's 1 package ───────────────────────────────────────────────────
  console.log("\n── Kolenius's package ──")
  {
    const kode = 'TRX/2026/01/0053'
    const order = orders.find(o => o.KODE === kode)!
    const rows = buildVisitRows(order, koleniusId, null, profiles)
    console.log(`  ${kode} (${order.LAYANAN}, ${order.STATUS}): ${rows.length} sessions`)
    if (APPLY) {
      const totalSessions = deriveTotalSessions(order.LAYANAN, doneSessions(order.sessions).length)
      const createdAt = parseDmyDash(order['DIBUAT TGL'])
      const { data: pkg, error: pkgErr } = await supabase.from('patient_packages').insert({
        patient_id: koleniusId, branch_id: BRANCH_ID, package_name: order.LAYANAN, package_type: 'fixed',
        total_sessions: totalSessions, jenis_paket: deriveJenisPaket(order.LAYANAN), mulai_paket: 'NEW',
        operational_status: deriveOperationalStatus(order.STATUS), status: deriveStatus(order.STATUS),
        notes: `kode:${order.KODE}`, legacy_used_sessions: 0,
        ...(createdAt ? { created_at: createdAt } : {}),
      }).select('id').single()
      if (pkgErr || !pkg) { console.error(`    FAIL: ${pkgErr?.message}`) } else {
        const { error: visitErr } = await supabase.from('patient_visits').insert(rows.map(r => ({ ...r, package_id: pkg.id })))
        if (visitErr) console.error(`    FAIL visits: ${visitErr.message}`)
      }
    }
  }

  // ── Kolenius's 3 standalone visits ─────────────────────────────────────────
  console.log("\n── Kolenius's standalone visits ──")
  for (const kode of ['TRX/2026/01/0048', 'TRX/2026/01/0042', 'TRX/2026/01/0015']) {
    const order = orders.find(o => o.KODE === kode)!
    const rows = buildVisitRows(order, koleniusId, null, profiles)
    console.log(`  ${kode} (${order.LAYANAN}): ${rows.length} visit(s), Rp${parseRp(order['TOTAL BAYAR'])}`)
    if (!APPLY || rows.length === 0) continue
    const { data: inserted, error } = await supabase.from('patient_visits').insert(rows).select('id, visit_date, service_type, attending_staff_id')
    if (error || !inserted) { console.error(`    FAIL: ${error?.message}`); continue }
    const amount = parseRp(order['TOTAL BAYAR'])
    if (amount > 0) {
      const target = inserted[inserted.length - 1]
      const { error: txErr } = await supabase.from('transactions').insert({
        visit_id: target.id, patient_id: koleniusId, branch_id: BRANCH_ID,
        fisio_id: target.attending_staff_id, type: 'income',
        category: SERVICE_TO_CATEGORY[target.service_type ?? ''] ?? 'LAINNYA',
        harga: parseRp(order.HARGA), discount: parseRp(order.DISKON), amount,
        payment_method: null, payment_status: order['STATUS BAYAR'] === 'Lunas' ? 'LUNAS' : 'DP',
        penjamin: null, description: `Impor data historis (KODE: ${order.KODE})`,
        transaction_date: target.visit_date, status: 'confirmed', recorded_by: null,
      })
      if (txErr) console.error(`    FAIL tx: ${txErr.message}`)
    }
  }

  console.log(`\n${APPLY ? 'Done — writes applied.' : 'DRY RUN — no writes performed. Re-run with --apply to write.'}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
