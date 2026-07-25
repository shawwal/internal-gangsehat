/**
 * Backfill `transactions` rows for standalone (non-package) completed
 * patient_visits that were imported from orders_with_sessions.json but never
 * got a payment record — this is why "Nominal Dibayar" shows "—" for them.
 *
 * Package sessions (visits with package_id set) are intentionally skipped:
 * they're pre-paid via a separate package-level transaction, not per-visit.
 *
 * Matching reuses the exact same patient+date+shift dedup key that
 * full-reset-reimport.ts used to create these patient_visits in the first
 * place, so every match is exact (no fuzzy/date-range guessing).
 *
 * Default is a DRY RUN (no writes). Pass --apply to actually insert.
 *
 * Run with: npx tsx data_migrations/backfill-visit-transactions.ts [--apply]
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

const APPLY = process.argv.includes('--apply')

const SERVICE_TO_CATEGORY: Record<string, string> = {
  'TERAPI AWAL':  'TA KLINIK',
  'SESI TERAPI':  'SESI KLINIK',
  'PAKET TERAPI': 'PAKET KLINIK',
  'TA VISIT':     'TA VISIT',
  'SESI VISIT':   'SESI VISIT',
  'PAKET VISIT':  'PAKET VISIT',
  'LAINNYA':      'LAINNYA',
}

// ── decryption (same as full-reset-reimport.ts) ────────────────────────────────
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
  TANGGAL: string
  JAM: string
  STATUS_SESI: string
  'NOMINAL BAYAR': string
  KETERANGAN: string
}

interface Order {
  KODE: string
  PASIEN: string
  LAYANAN: string
  'DIBUAT TGL': string
  HARGA: string
  DISKON: string
  'TOTAL BAYAR': string
  'STATUS BAYAR': string
  sessions: Session[]
}

interface VisitRow {
  id: string
  patient_id: string
  branch_id: string
  visit_date: string
  shift: string | null
  service_type: string | null
  attending_staff_id: string | null
}

// ── helpers (same as full-reset-reimport.ts) ────────────────────────────────────
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

function parseRp(s: string | undefined | null): number {
  if (!s) return 0
  const n = s.replace(/[^0-9]/g, '')
  return n ? parseInt(n, 10) : 0
}

async function fetchAll<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  select: string,
  filter?: (q: any) => any,
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
const MIGRATION_DIR = __dirname
const orders: Order[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_with_sessions.json'), 'utf8')
)
console.log(`Loaded ${orders.length} orders  (mode: ${APPLY ? 'APPLY — will write' : 'DRY RUN — no writes'})`)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // ── Reference data ─────────────────────────────────────────────────────────
  console.log('\nFetching patients...')
  const patients = await fetchAll<{ id: string; encrypted_name: string }>(
    supabase, 'patients', 'id, encrypted_name',
  )
  const nameToId = new Map<string, string>()
  for (const p of patients) {
    const name = p.encrypted_name ? normName(decrypt(p.encrypted_name)) : ''
    if (name) nameToId.set(name, p.id)
  }
  console.log(`  ${patients.length} patients, ${nameToId.size} decrypted`)

  console.log('Fetching standalone completed visits (package_id IS NULL, status=completed)...')
  const visits = await fetchAll<VisitRow>(
    supabase, 'patient_visits',
    'id, patient_id, branch_id, visit_date, shift, service_type, attending_staff_id',
    (q) => q.is('package_id', null).eq('status', 'completed'),
  )
  console.log(`  ${visits.length} candidate visits`)

  const visitKeyMap = new Map<string, VisitRow>()
  for (const v of visits) {
    const key = `${v.patient_id}::${v.visit_date}::${v.shift ?? 'PAGI'}`
    visitKeyMap.set(key, v)
  }

  console.log('Fetching existing non-rejected transactions linked to a visit...')
  const visitIds = new Set(visits.map(v => v.id))
  const existingTx = await fetchAll<{ visit_id: string }>(
    supabase, 'transactions', 'visit_id',
    (q) => q.not('visit_id', 'is', null).neq('status', 'rejected'),
  )
  const visitsWithTx = new Set(
    existingTx.map(t => t.visit_id).filter(id => visitIds.has(id))
  )
  console.log(`  ${visitsWithTx.size} candidate visits already have a transaction`)

  // ── Match orders → visits ────────────────────────────────────────────────────
  const standaloneOrders = orders.filter(o => !o.LAYANAN?.toUpperCase().startsWith('PAKET'))
  console.log(`\n${standaloneOrders.length} standalone (non-PAKET) orders to process`)

  type PlannedTx = {
    visit_id: string
    patient_id: string
    branch_id: string
    fisio_id: string | null
    type: 'income'
    category: string
    harga: number
    discount: number
    amount: number
    payment_method: null
    payment_status: 'LUNAS' | 'DP'
    penjamin: null
    description: string
    transaction_date: string
    status: 'confirmed'
    recorded_by: null
  }

  const planned: PlannedTx[] = []
  let skipNoPatient = 0, skipNoVisitMatch = 0, skipZeroAmount = 0, skipAlreadyHasTx = 0

  for (const order of standaloneOrders) {
    const patientId = nameToId.get(normName(order.PASIEN))
    if (!patientId) { skipNoPatient++; continue }

    const matchedVisits: VisitRow[] = []
    for (const s of doneSessions(order.sessions)) {
      const visitDate = parseDate(s.TANGGAL)
      if (!visitDate) continue
      const shift = deriveShift(s.JAM)
      const key = `${patientId}::${visitDate}::${shift}`
      const v = visitKeyMap.get(key)
      if (v && !matchedVisits.some(mv => mv.id === v.id)) matchedVisits.push(v)
    }
    if (matchedVisits.length === 0) { skipNoVisitMatch++; continue }

    // Multiple sessions on one order (e.g. a reschedule) → the payment covers
    // the whole order, attribute it to the chronologically last matched visit.
    matchedVisits.sort((a, b) => a.visit_date.localeCompare(b.visit_date))
    const target = matchedVisits[matchedVisits.length - 1]

    const amount = parseRp(order['TOTAL BAYAR'])
    if (amount <= 0) { skipZeroAmount++; continue }

    if (visitsWithTx.has(target.id)) { skipAlreadyHasTx++; continue }

    const harga = parseRp(order.HARGA)
    const discount = parseRp(order.DISKON)
    const category = SERVICE_TO_CATEGORY[target.service_type ?? ''] ?? 'LAINNYA'
    const paymentStatus: 'LUNAS' | 'DP' = order['STATUS BAYAR'] === 'Lunas' ? 'LUNAS' : 'DP'

    planned.push({
      visit_id:         target.id,
      patient_id:       patientId,
      branch_id:        target.branch_id,
      fisio_id:         target.attending_staff_id,
      type:             'income',
      category,
      harga,
      discount,
      amount,
      payment_method:   null,
      payment_status:   paymentStatus,
      penjamin:         null,
      description:      `Impor data historis (KODE: ${order.KODE})`,
      transaction_date: target.visit_date,
      status:           'confirmed',
      recorded_by:      null,
    })
    // Mark as claimed so a later order in this loop can't double-book the same visit.
    visitsWithTx.add(target.id)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalRupiah = planned.reduce((s, p) => s + p.amount, 0)
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Matching summary:
  Orders processed:              ${standaloneOrders.length}
  Skipped (patient not found):   ${skipNoPatient}
  Skipped (no matching visit):   ${skipNoVisitMatch}
  Skipped (zero amount paid):    ${skipZeroAmount}
  Skipped (visit already has tx):${skipAlreadyHasTx}
  Transactions to insert:        ${planned.length}
  Total amount:                  Rp${totalRupiah.toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  console.log('Sample of planned inserts:')
  for (const p of planned.slice(0, 15)) {
    console.log(`  visit=${p.visit_id}  ${p.transaction_date}  ${p.category.padEnd(12)}  harga=${p.harga}  amount=${p.amount}  status=${p.payment_status}  (${p.description})`)
  }

  if (!APPLY) {
    console.log('\nDry run only — re-run with --apply to write these rows.')
    return
  }

  console.log(`\nInserting ${planned.length} transactions...`)
  const CHUNK = 200
  let inserted = 0
  for (let i = 0; i < planned.length; i += CHUNK) {
    const chunk = planned.slice(i, i + CHUNK)
    const { error } = await supabase.from('transactions').insert(chunk)
    if (error) {
      console.error(`  FAIL chunk ${i}-${i + chunk.length}: ${error.message}`)
      continue
    }
    inserted += chunk.length
    console.log(`  inserted ${inserted}/${planned.length}`)
  }
  console.log(`\nDone. Inserted ${inserted}/${planned.length} transactions.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
