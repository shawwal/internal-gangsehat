/**
 * Migrate patients that were skipped by every prior import pass because
 * their order-system name (orders_with_sessions.json PASIEN) never matched
 * any row in `patients` by exact decrypted name.
 *
 * Resolution, per unmatched name:
 *  - Junk placeholder ("PASIEN SCOLIOSIS", "TERAPI AWAL 1/2/3", ...) → skipped.
 *  - Phone number matches an EXISTING patient (common cause: staff appended
 *    phone digits to a duplicate first name, e.g. "SUMIATI 8912") → treated
 *    as that existing patient, no new row created.
 *  - Phone number matches nobody, but the name is found in the rich patient
 *    CSV ("DATA PASIEN 2026...csv") or patients_complete.json → a genuinely
 *    new patient, created with full PII from whichever source has it.
 *  - Neither source has it → left unresolved, reported only.
 *
 * For every resolved name (existing-by-phone or newly-created), this script
 * then imports that name's orders exactly like full-reset-reimport.ts does
 * (PAKET → patient_package + sessions, else → standalone patient_visits),
 * and backfills a `transactions` row for standalone completed visits using
 * the same logic as backfill-visit-transactions.ts.
 *
 * Default is a DRY RUN (no writes). Pass --apply to actually write.
 *
 * Run with: npx tsx data_migrations/migrate-missing-patients.ts [--apply]
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
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

const SERVICE_TO_CATEGORY: Record<string, string> = {
  'TERAPI AWAL':  'TA KLINIK',
  'SESI TERAPI':  'SESI KLINIK',
  'PAKET TERAPI': 'PAKET KLINIK',
  'TA VISIT':     'TA VISIT',
  'SESI VISIT':   'SESI VISIT',
  'PAKET VISIT':  'PAKET VISIT',
  'LAINNYA':      'LAINNYA',
}

const JUNK_RE = /^(PASIEN SCOLIOSIS( \d+)?|TERAPI AWAL \d+|TEST|TESTING|DUMMY|CONTOH)$/i

// ── crypto (same as full-reset-reimport.ts / lib/encryption.ts) ────────────────
const encKey = Buffer.from(ENCRYPTION_KEY, 'hex')

function decrypt(enc: string): string {
  if (!enc) return enc
  const parts = enc.split(':')
  if (parts.length !== 3) return enc
  try {
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    if (iv.length !== 16 || tag.length !== 16) return enc
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, iv)
    d.setAuthTag(tag)
    let r = d.update(parts[2], 'hex', 'utf8')
    r += d.final('utf8')
    return r
  } catch { return enc }
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function hashPhone(phone: string): string {
  const normalized = String(phone).replace(/[\s\-().+]/g, '').replace(/^0/, '62')
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

function normName(s: string): string { return String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ') }

// ── orders_with_sessions.json helpers (same as full-reset-reimport.ts) ────────
interface Session {
  TANGGAL: string; JAM: string; FISIO: string; STATUS_SESI: string
  'NOMINAL BAYAR': string; KETERANGAN: string
}
interface Order {
  KODE: string; PASIEN: string; LAYANAN: string; STATUS: string
  'DIBUAT TGL': string; HARGA: string; DISKON: string
  'TOTAL BAYAR': string; 'STATUS BAYAR': string; sessions: Session[]
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
  const h = parseInt(jam.split(':')[0], 10)
  return h < 12 ? 'PAGI' : 'SORE'
}

function deriveKehadiran(statusSesi: string): 'HADIR' | 'TIDAK HADIR' {
  return statusSesi === 'Tidak Hadir' ? 'TIDAK HADIR' : 'HADIR'
}

function deriveVisitServiceType(layanan: string): string {
  const u = (layanan ?? '').toUpperCase()
  if (u.startsWith('PAKET')) return u.includes('VISIT') ? 'PAKET VISIT' : 'PAKET TERAPI'
  if (u === 'TERAPI AWAL') return 'TERAPI AWAL'
  if (u === 'TA VISIT')    return 'TA VISIT'
  if (u.includes('VISIT')) return 'SESI VISIT'
  return 'SESI TERAPI'
}

function deriveTotalSessions(layanan: string, sessions: Session[]): number {
  const u = (layanan ?? '').toUpperCase()
  if (u === 'PAKET 1' || u === 'PAKET SILVER') return 5
  if (u === 'PAKET 2' || u === 'PAKET GOLD')   return 10
  if (u === 'PAKET PLATINUM')                   return 20
  return Math.max(sessions?.length ?? 1, 1)
}

function deriveJenisPaket(layanan: string): 'P1' | 'P2' | null {
  const u = (layanan ?? '').toUpperCase()
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
  for (const p of profiles) {
    if (p.full_name.toUpperCase().split(/\s+/).some(w => w === upper)) return p.id
  }
  for (const p of profiles) {
    if (p.full_name.toUpperCase().split(/\s+/).some(w => w.startsWith(upper) && upper.length >= 3)) return p.id
  }
  return null
}

function doneSessions(sessions: Session[]): Session[] {
  return (sessions ?? []).filter(
    s => s['NOMINAL BAYAR'] === 'Sudah Ditangani' || s.STATUS_SESI === 'Hadir' || s.STATUS_SESI === 'Tidak Hadir'
  )
}

// ── patient source records ──────────────────────────────────────────────────
interface PatientRecord {
  no_rm: string | null
  phone: string | null
  gender: string | null      // 'LAKI-LAKI' | 'PEREMPUAN'
  birth_date: string | null  // DD/MM/YYYY (CSV) — null for patients_complete
  address: string | null
  kelurahan: string | null
  kecamatan: string | null
  kabupaten_kota: string | null
  provinsi: string | null
  agama: string | null
  pekerjaan: string | null
  keluhan: string | null
  hobi: string | null
}

function loadCsvPatients(): Map<string, PatientRecord> {
  const wb = XLSX.readFile(path.join(__dirname, 'DATA PASIEN 2026 - 🙎_♂️ Pasien (1).csv'))
  const rows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1, raw: false, defval: '' })
  const header = rows[1]
  const idx: Record<string, number> = {}
  header.forEach((h, i) => { if (h) idx[h] = i })
  const map = new Map<string, PatientRecord>()
  for (const r of rows.slice(2)) {
    const name = normName(r[idx['Nama Pasien']])
    if (!name || name === 'OFF' || name === 'LIBUR') continue
    if (map.has(name)) continue
    map.set(name, {
      no_rm:          r[idx['No. RM']] || null,
      phone:          r[idx['No. WA']] || null,
      gender:         r[idx['Jenis Kelamin']] || null,
      birth_date:     r[idx['Tanggal Lahir']] || null,
      address:        r[idx['Alamat']] || null,
      kelurahan:      r[idx['Kel./Desa']] || null,
      kecamatan:      r[idx['Kecamatan']] || null,
      kabupaten_kota: r[idx['Kab./Kota']] || null,
      provinsi:       r[idx['Provinsi']] || null,
      agama:          r[idx['Agama']] || null,
      pekerjaan:      r[idx['Pekerjaan']] || null,
      keluhan:        r[idx['Keluhan']] || null,
      hobi:           r[idx['Hobi/Aktivitas Sehari-hari']] || null,
    })
  }
  return map
}

function loadPatientsCompletePatients(): Map<string, PatientRecord> {
  const pc: { Nama: string; 'Kode/RM': string; 'Nomor HP': string; 'Jenis Kelamin': string }[] =
    JSON.parse(fs.readFileSync(path.join(__dirname, 'patients_complete.json'), 'utf8'))
  const map = new Map<string, PatientRecord>()
  for (const p of pc) {
    const name = normName(p.Nama)
    if (!name || map.has(name)) continue
    map.set(name, {
      no_rm: p['Kode/RM'] || null, phone: p['Nomor HP'] || null, gender: p['Jenis Kelamin'] || null,
      birth_date: null, address: null, kelurahan: null, kecamatan: null, kabupaten_kota: null,
      provinsi: null, agama: null, pekerjaan: null, keluhan: null, hobi: null,
    })
  }
  return map
}

async function fetchAll<T>(
  supabase: ReturnType<typeof createClient>, table: string, select: string, filter?: (q: any) => any,
): Promise<T[]> {
  const rows: T[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as unknown as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

// ── main ──────────────────────────────────────────────────────────────────────
const orders: Order[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'orders_with_sessions.json'), 'utf8'))
console.log(`Loaded ${orders.length} orders  (mode: ${APPLY ? 'APPLY — will write' : 'DRY RUN — no writes'})`)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // ── Reference data ─────────────────────────────────────────────────────────
  console.log('\nFetching existing patients...')
  const patients = await fetchAll<{ id: string; encrypted_name: string; phone_hash: string | null }>(
    supabase, 'patients', 'id, encrypted_name, phone_hash',
  )
  const nameToId = new Map<string, string>()
  const phoneHashToId = new Map<string, string>()
  for (const p of patients) {
    const n = p.encrypted_name ? normName(decrypt(p.encrypted_name)) : ''
    if (n) nameToId.set(n, p.id)
    if (p.phone_hash) phoneHashToId.set(p.phone_hash, p.id)
  }
  console.log(`  ${patients.length} patients loaded`)

  const { data: profilesData } = await supabase.from('internal_profiles').select('id, full_name')
  const profiles = (profilesData ?? []) as { id: string; full_name: string }[]

  const csvByName = loadCsvPatients()
  const pcByName = loadPatientsCompletePatients()
  console.log(`  CSV source: ${csvByName.size} names, patients_complete.json: ${pcByName.size} names`)

  // ── Resolve every unmatched name ─────────────────────────────────────────────
  const unmatchedNames = new Map<string, number>()
  for (const o of orders) {
    const n = normName(o.PASIEN)
    if (!nameToId.has(n)) unmatchedNames.set(n, (unmatchedNames.get(n) ?? 0) + 1)
  }
  console.log(`\n${unmatchedNames.size} distinct unmatched patient names across all orders`)

  type Resolution =
    | { action: 'skip-junk' }
    | { action: 'existing'; patientId: string }
    | { action: 'create'; rec: PatientRecord; source: 'CSV' | 'patients_complete' }
    | { action: 'unresolvable' }

  const resolutions = new Map<string, Resolution>()
  let skipJunk = 0, existing = 0, toCreate = 0, unresolvable = 0

  for (const name of unmatchedNames.keys()) {
    if (JUNK_RE.test(name)) { resolutions.set(name, { action: 'skip-junk' }); skipJunk++; continue }

    const csvRec = csvByName.get(name)
    const pcRec = pcByName.get(name)
    const candidates: { phone: string; rec: PatientRecord; source: 'CSV' | 'patients_complete' }[] = []
    if (csvRec?.phone) candidates.push({ phone: csvRec.phone, rec: csvRec, source: 'CSV' })
    if (pcRec?.phone)  candidates.push({ phone: pcRec.phone,  rec: pcRec,  source: 'patients_complete' })

    let matched: string | null = null
    for (const c of candidates) {
      const h = hashPhone(c.phone)
      if (phoneHashToId.has(h)) { matched = phoneHashToId.get(h)!; break }
    }

    if (matched) {
      resolutions.set(name, { action: 'existing', patientId: matched })
      existing++
    } else if (candidates.length > 0) {
      resolutions.set(name, { action: 'create', rec: candidates[0].rec, source: candidates[0].source })
      toCreate++
    } else {
      resolutions.set(name, { action: 'unresolvable' })
      unresolvable++
    }
  }

  console.log(`  skip-junk: ${skipJunk}   existing-by-phone: ${existing}   create-new: ${toCreate}   unresolvable: ${unresolvable}`)

  const unresolvableNames = [...resolutions.entries()].filter(([, r]) => r.action === 'unresolvable').map(([n]) => n)
  if (unresolvableNames.length) console.log(`  Unresolvable names (skipped): ${unresolvableNames.join(', ')}`)

  // ── Create new patients ──────────────────────────────────────────────────────
  const toCreateEntries = [...resolutions.entries()].filter(([, r]) => r.action === 'create') as [string, Extract<Resolution, { action: 'create' }>][]
  console.log(`\nCreating ${toCreateEntries.length} new patients${APPLY ? '' : ' (dry run — not writing)'}...`)

  for (const [name, r] of toCreateEntries) {
    const rec = r.rec
    const gender = rec.gender?.toUpperCase() === 'LAKI-LAKI' ? 'male' : rec.gender?.toUpperCase() === 'PEREMPUAN' ? 'female' : null
    const birthDate = parseDmySlash(rec.birth_date)
    const displayName = name.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')

    console.log(`  + ${displayName}  (no_rm=${rec.no_rm}  phone=${rec.phone}  source=${r.source})`)

    if (!APPLY) {
      resolutions.set(name, { action: 'existing', patientId: `dryrun:${name}` })
      continue
    }

    const { data, error } = await supabase.from('patients').insert({
      encrypted_name:       encrypt(displayName),
      encrypted_phone:      encrypt(String(rec.phone)),
      encrypted_address:    rec.address ? encrypt(rec.address) : null,
      encrypted_birth_date: birthDate ? encrypt(birthDate) : null,
      gender,
      phone_hash:           hashPhone(String(rec.phone)),
      name_normalized:      displayName.trim().toLowerCase(),
      no_rm:                rec.no_rm ?? null,
      pekerjaan:            rec.pekerjaan ?? null,
      agama:                rec.agama ?? null,
      hobi:                 rec.hobi ?? null,
      kelurahan:            rec.kelurahan ?? null,
      kecamatan:            rec.kecamatan ?? null,
      kabupaten_kota:       rec.kabupaten_kota ?? null,
      provinsi:             rec.provinsi ?? null,
      keluhan:              rec.keluhan ?? null,
    }).select('id').single()

    if (error || !data) { console.error(`    FAIL: ${error?.message}`); continue }
    resolutions.set(name, { action: 'existing', patientId: data.id }) // reuse 'existing' path from here on
  }

  // Build final name → patientId map for orders processing
  const resolvedPatientId = new Map<string, string>()
  for (const [name, r] of resolutions) {
    if (r.action === 'existing') resolvedPatientId.set(name, r.patientId)
  }
  // Also fold in the always-matched names (unaffected patients) so buildVisitRows can look up freely if needed later
  for (const [name, id] of nameToId) resolvedPatientId.set(name, id)

  if (!APPLY) {
    console.log('\nDry run stops here for patient creation — visit/transaction planning below uses only ALREADY-EXISTING patient ids, so newly-would-be-created patients show 0 planned visits in this preview.')
  }

  // ── Existing visits per resolved patient (to avoid duplicate inserts for the "existing-by-phone" group) ──
  const resolvedIds = [...new Set([...resolutions.values()].filter(r => r.action === 'existing').map(r => (r as any).patientId as string))]
    .filter(id => !id.startsWith('dryrun:'))
  const existingVisits = resolvedIds.length
    ? await fetchAll<{ patient_id: string; visit_date: string; shift: string | null }>(
        supabase, 'patient_visits', 'patient_id, visit_date, shift', (q) => q.in('patient_id', resolvedIds),
      )
    : []
  const seenVisitKeys = new Set(existingVisits.map(v => `${v.patient_id}::${v.visit_date}::${v.shift ?? 'PAGI'}`))

  // ── Import orders for every resolved name ────────────────────────────────────
  const targetOrders = orders.filter(o => resolutions.has(normName(o.PASIEN)) && resolutions.get(normName(o.PASIEN))!.action !== 'skip-junk' && resolutions.get(normName(o.PASIEN))!.action !== 'unresolvable')
  console.log(`\n${targetOrders.length} orders belong to resolved names — importing visits/packages/transactions...`)

  const paketOrders = targetOrders.filter(o => o.LAYANAN?.toUpperCase().startsWith('PAKET'))
  const standaloneOrders = targetOrders.filter(o => !o.LAYANAN?.toUpperCase().startsWith('PAKET'))

  let pkgsCreated = 0, pkgSessions = 0, pkgSkippedNoPatient = 0
  let standaloneVisits = 0, standaloneSkippedNoPatient = 0
  let txPlanned = 0, txSkippedZero = 0, txTotalAmount = 0

  // PAKET orders → package + sessions
  for (const order of paketOrders) {
    const patientId = resolvedPatientId.get(normName(order.PASIEN))
    if (!patientId) { pkgSkippedNoPatient++; continue }

    const rows: any[] = []
    for (const s of doneSessions(order.sessions)) {
      const visitDate = parseDmyDash(s.TANGGAL)
      if (!visitDate) continue
      const shift = deriveShift(s.JAM)
      const key = `${patientId}::${visitDate}::${shift}`
      if (seenVisitKeys.has(key)) continue
      seenVisitKeys.add(key)
      rows.push({
        patient_id: patientId, branch_id: BRANCH_ID,
        visit_date: visitDate, visit_time: s.JAM && s.JAM !== '-' ? s.JAM : null, shift,
        service_type: deriveVisitServiceType(order.LAYANAN), kehadiran: deriveKehadiran(s.STATUS_SESI),
        status: 'completed', attending_staff_id: matchTherapist(s.FISIO, profiles),
      })
    }
    if (rows.length === 0) continue

    console.log(`  PKG ${order.KODE} → ${order.PASIEN} / ${order.LAYANAN}: ${rows.length} sessions`)
    if (!APPLY) { pkgsCreated++; pkgSessions += rows.length; continue }

    const totalSessions = deriveTotalSessions(order.LAYANAN, order.sessions)
    const createdAt = parseDmyDash(order['DIBUAT TGL'])
    const { data: newPkg, error: pkgErr } = await supabase.from('patient_packages').insert({
      patient_id: patientId, branch_id: BRANCH_ID, package_name: order.LAYANAN, package_type: 'fixed',
      total_sessions: totalSessions, jenis_paket: deriveJenisPaket(order.LAYANAN), mulai_paket: 'NEW',
      operational_status: deriveOperationalStatus(order.STATUS), status: deriveStatus(order.STATUS),
      notes: `kode:${order.KODE}`, legacy_used_sessions: 0,
      ...(createdAt ? { created_at: createdAt } : {}),
    }).select('id').single()
    if (pkgErr || !newPkg) { console.error(`    FAIL pkg: ${pkgErr?.message}`); continue }
    pkgsCreated++

    const { error: visitErr } = await supabase.from('patient_visits').insert(rows.map(r => ({ ...r, package_id: newPkg.id })))
    if (visitErr) { console.error(`    FAIL sessions: ${visitErr.message}`); continue }
    pkgSessions += rows.length
  }

  // Standalone orders → visits + transaction
  for (const order of standaloneOrders) {
    const patientId = resolvedPatientId.get(normName(order.PASIEN))
    if (!patientId) { standaloneSkippedNoPatient++; continue }

    const matchedInsertedVisits: { visit_date: string; row: any }[] = []
    for (const s of doneSessions(order.sessions)) {
      const visitDate = parseDmyDash(s.TANGGAL)
      if (!visitDate) continue
      const shift = deriveShift(s.JAM)
      const key = `${patientId}::${visitDate}::${shift}`
      if (seenVisitKeys.has(key)) continue
      seenVisitKeys.add(key)
      const serviceType = deriveVisitServiceType(order.LAYANAN)
      matchedInsertedVisits.push({
        visit_date: visitDate,
        row: {
          patient_id: patientId, branch_id: BRANCH_ID, visit_date: visitDate,
          visit_time: s.JAM && s.JAM !== '-' ? s.JAM : null, shift, service_type: serviceType,
          kehadiran: deriveKehadiran(s.STATUS_SESI), status: 'completed',
          attending_staff_id: matchTherapist(s.FISIO, profiles),
        },
      })
    }
    if (matchedInsertedVisits.length === 0) continue

    let insertedIds: string[] = []
    if (!APPLY) {
      standaloneVisits += matchedInsertedVisits.length
      insertedIds = matchedInsertedVisits.map(() => '(dry-run)')
    } else {
      const { data: inserted, error } = await supabase.from('patient_visits')
        .insert(matchedInsertedVisits.map(v => v.row)).select('id, visit_date')
      if (error) { console.error(`  FAIL standalone ${order.KODE}: ${error.message}`); continue }
      standaloneVisits += inserted.length
      insertedIds = inserted.map((v: any) => v.id)
      matchedInsertedVisits.forEach((v, i) => { (v as any).id = inserted[i].id })
    }

    // Payment backfill — attribute to the chronologically last visit, same as backfill-visit-transactions.ts
    const amount = parseRp(order['TOTAL BAYAR'])
    if (amount <= 0) { txSkippedZero++; continue }
    const target = matchedInsertedVisits.sort((a, b) => a.visit_date.localeCompare(b.visit_date))[matchedInsertedVisits.length - 1]
    const harga = parseRp(order.HARGA)
    const discount = parseRp(order.DISKON)
    const category = SERVICE_TO_CATEGORY[target.row.service_type ?? ''] ?? 'LAINNYA'
    const paymentStatus = order['STATUS BAYAR'] === 'Lunas' ? 'LUNAS' : 'DP'

    txPlanned++
    txTotalAmount += amount

    if (!APPLY) continue
    const { error: txErr } = await supabase.from('transactions').insert({
      visit_id: (target as any).id, patient_id: patientId, branch_id: BRANCH_ID,
      fisio_id: target.row.attending_staff_id, type: 'income', category, harga, discount, amount,
      payment_method: null, payment_status: paymentStatus, penjamin: null,
      description: `Impor data historis (KODE: ${order.KODE})`, transaction_date: target.visit_date,
      status: 'confirmed', recorded_by: null,
    })
    if (txErr) console.error(`  FAIL tx for ${order.KODE}: ${txErr.message}`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Patient resolution:
  Junk skipped:                 ${skipJunk}
  Matched to existing patient:  ${existing}
  New patients ${APPLY ? 'created' : 'to create'}:          ${toCreate}
  Unresolvable:                 ${unresolvable}

Packages:
  ${APPLY ? 'Created' : 'To create'}: ${pkgsCreated}   Sessions: ${pkgSessions}   Skipped (no patient): ${pkgSkippedNoPatient}

Standalone visits:
  ${APPLY ? 'Inserted' : 'To insert'}: ${standaloneVisits}   Skipped (no patient): ${standaloneSkippedNoPatient}

Transactions:
  ${APPLY ? 'Inserted' : 'To insert'}: ${txPlanned}   Skipped (zero amount): ${txSkippedZero}
  Total amount: Rp${txTotalAmount.toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${APPLY ? '' : '\nDry run only — re-run with --apply to write.'}
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
