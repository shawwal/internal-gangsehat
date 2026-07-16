/**
 * Backfill visit_time for patient_visits rows left NULL by earlier imports.
 *
 * Non-destructive: only UPDATEs visit_time on rows where it is currently NULL.
 * Re-derives the value from orders_with_sessions.json using the same
 * dedup rule (visit_date + shift, first session wins) that full-reset-reimport.ts
 * used when it originally created these rows, so matches line up 1:1.
 *
 * Run with: npx tsx data_migrations/backfill-visit-time.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

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

// ── decryption ───────────────────────────────────────────────────────────────
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

function normName(s: string): string { return s.trim().toUpperCase() }

// ── types ─────────────────────────────────────────────────────────────────────
interface Session {
  PERTEMUAN: string
  TANGGAL: string
  JAM: string
  FISIO: string
  STATUS_SESI: string
  'NOMINAL BAYAR': string
  KETERANGAN: string
}

interface Order {
  KODE: string
  PASIEN: string
  LAYANAN: string
  STATUS: string
  'DIBUAT TGL': string
  sessions: Session[]
}

// ── helpers (mirrors full-reset-reimport.ts) ───────────────────────────────────
function parseDate(dmy: string): string | null {
  if (!dmy) return null
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function deriveShift(jam: string): 'PAGI' | 'SORE' {
  if (!jam || jam === '-') return 'PAGI'
  const h = parseInt(jam.split(':')[0], 10)
  return h < 12 ? 'PAGI' : 'SORE'
}

function doneSessions(sessions: Session[]): Session[] {
  return (sessions ?? []).filter(
    s => s['NOMINAL BAYAR'] === 'Sudah Ditangani'
      || s.STATUS_SESI === 'Hadir'
      || s.STATUS_SESI === 'Tidak Hadir'
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
const MIGRATION_DIR = __dirname
const orders: Order[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_with_sessions.json'), 'utf8')
)
console.log(`Loaded ${orders.length} orders`)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log('\nFetching patients...')
  const allPatients: { id: string; encrypted_name: string }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('patients')
      .select('id, encrypted_name').range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPatients.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  const nameToId = new Map<string, string>()
  for (const p of allPatients) {
    const name = p.encrypted_name ? normName(decrypt(p.encrypted_name)) : ''
    if (name) nameToId.set(name, p.id)
  }
  console.log(`  ${allPatients.length} patients, ${nameToId.size} decrypted`)

  // Build lookup: `${patientId}::${visitDate}::${shift}` -> JAM
  // Same dedup rule as buildVisitRows() in full-reset-reimport.ts (first session wins).
  console.log('\nBuilding visit_time lookup from orders_with_sessions.json...')
  const jamLookup = new Map<string, string>()
  const seenPerOrder = new Set<string>() // mirrors the per-order `seen` set during original import
  for (const order of orders) {
    const patientId = nameToId.get(normName(order.PASIEN))
    if (!patientId) continue
    for (const s of doneSessions(order.sessions)) {
      const visitDate = parseDate(s.TANGGAL)
      if (!visitDate) continue
      const shift = deriveShift(s.JAM)
      const dedupKey = `${order.KODE}::${visitDate}::${shift}`
      if (seenPerOrder.has(dedupKey)) continue
      seenPerOrder.add(dedupKey)
      if (!s.JAM || s.JAM === '-') continue
      const lookupKey = `${patientId}::${visitDate}::${shift}`
      // Multiple orders for the same patient/date/shift: keep first (matches import order).
      if (!jamLookup.has(lookupKey)) jamLookup.set(lookupKey, s.JAM)
    }
  }
  console.log(`  ${jamLookup.size} lookup entries built`)

  // Fetch rows needing backfill
  console.log('\nFetching patient_visits with visit_time IS NULL...')
  const rowsToFix: { id: string; patient_id: string; visit_date: string; shift: string | null }[] = []
  from = 0
  while (true) {
    const { data, error } = await supabase.from('patient_visits')
      .select('id, patient_id, visit_date, shift')
      .is('visit_time', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rowsToFix.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  ${rowsToFix.length} rows with NULL visit_time`)

  let matched = 0
  let unmatched = 0
  let failed = 0

  for (const row of rowsToFix) {
    const shift = row.shift ?? 'PAGI'
    const key = `${row.patient_id}::${row.visit_date}::${shift}`
    const jam = jamLookup.get(key)
    if (!jam) { unmatched++; continue }

    const { error } = await supabase.from('patient_visits')
      .update({ visit_time: jam })
      .eq('id', row.id)
    if (error) {
      console.error(`  FAIL ${row.id}: ${error.message}`)
      failed++
      continue
    }
    matched++
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.

Rows with NULL visit_time: ${rowsToFix.length}
  Updated (matched):       ${matched}
  No match (left NULL):    ${unmatched}
  Failures:                ${failed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
