/**
 * Backfill a "package purchase" transaction for every patient_packages row
 * that doesn't have one yet — this is why the Pembayaran column never shows
 * a "Paket Rp..." badge on package-session visits.
 *
 * Two data sources, used together:
 *  - orders_with_sessions.json — reliable per-package identity via
 *    patient_packages.notes = 'kode:<KODE>', gives HARGA/DISKON/TOTAL BAYAR/
 *    STATUS BAYAR/DIBUAT TGL for every package (same link used by
 *    full-reset-reimport.ts and migrate-missing-patients.ts).
 *  - CATATAN KEUANGAN FGS PTK 2026.xlsx, ⬇️ PEMASUKAN sheet — the real
 *    day-by-day payment ledger (KATEGORI PEMBELIAN = paket rows), giving the
 *    true payment date, payment method, and penjamin. It has no KODE column,
 *    so it's matched to a package by (patient name, amount, date proximity)
 *    rather than exact identity.
 *
 * Consecutive ledger rows for the same patient within 45 days are grouped
 * into one "purchase event" (handles DP → CICILAN → PELUNASAN installment
 * sequences), then each patient_package is greedily paired with the ledger
 * event whose total amount matches its order's TOTAL BAYAR and whose date is
 * closest to the order's DIBUAT TGL. Packages with no confident ledger match
 * fall back to the order's own DIBUAT TGL as the transaction date — still
 * populates the field, just without ledger-verified payment method/date.
 *
 * The transaction is attached (visit_id) to the package's earliest completed
 * session, matching how getPackageSale() reads it in the visits page.
 *
 * Default is a DRY RUN (no writes). Pass --apply to actually write.
 *
 * Run with: npx tsx data_migrations/backfill-package-transactions.ts [--apply]
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
const PACKAGE_CATEGORIES_LEDGER = new Set(['KLINIK FT PAKET', 'VISIT FT PAKET'])
const EVENT_GAP_DAYS = 14
const MATCH_WINDOW_DAYS = 21
const ALLOWED_PAYMENT_METHODS = new Set(['TUNAI', 'TRANSFER BCA', 'EDC BCA'])

// ── crypto ───────────────────────────────────────────────────────────────────
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
function normName(s: string): string { return String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ') }

function parseDmyDash(dmy: string | null): string | null {
  if (!dmy) return null
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', Mei: '05', May: '05', Jun: '06',
  Jul: '07', Agu: '08', Aug: '08', Sep: '09', Okt: '10', Oct: '10', Nov: '11', Des: '12', Dec: '12',
}
function parseLedgerDate(s: string | null): string | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!m) return null
  const [, d, mon, y] = m
  const mm = MONTHS[mon]
  if (!mm) return null
  return `${y}-${mm}-${d.padStart(2, '0')}`
}

function parseRp(s: string | undefined | null): number {
  if (!s) return 0
  const n = String(s).replace(/[^0-9]/g, '')
  return n ? parseInt(n, 10) : 0
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
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

// ── ledger ───────────────────────────────────────────────────────────────────
interface LedgerRow {
  date: string; kategori: string; jumlahBayar: number; diskon: number; harga: number
  metodeBayar: string; ketBayar: string; penjamin: string; fisio: string
}
interface LedgerEvent {
  patientName: string; startDate: string; endDate: string; totalAmount: number
  harga: number; discount: number; paymentMethod: string | null; paymentStatus: string
  penjamin: string | null; fisio: string | null; claimed: boolean
}

function loadLedgerPaketEvents(): Map<string, LedgerEvent[]> {
  const wb = XLSX.readFile(path.join(__dirname, 'CATATAN KEUANGAN FGS PTK 2026.xlsx'))
  const rows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets['⬇️ PEMASUKAN'], { header: 1, raw: false, defval: '' })
  const header = rows[3]
  const idx: Record<string, number> = {}
  header.forEach((h, i) => { if (h) idx[h] = i })

  const byPatient = new Map<string, LedgerRow[]>()
  for (const r of rows.slice(4)) {
    const kategori = r[idx['KATEGORI PEMBELIAN']]
    if (!PACKAGE_CATEGORIES_LEDGER.has(kategori)) continue
    const date = parseLedgerDate(r[idx['TANGGAL']])
    if (!date) continue
    const name = normName(r[idx['NAMA PASIEN']])
    if (!name) continue
    const row: LedgerRow = {
      date, kategori,
      jumlahBayar: parseRp(r[idx['JUMLAH BAYAR']]),
      diskon: parseRp(r[idx['DISKON']]),
      harga: parseRp(r[idx['HARGA']]),
      metodeBayar: r[idx['METODE BAYAR']] || '',
      ketBayar: r[idx['KETERANGAN BAYAR']] || '',
      penjamin: r[idx['PENJAMIN']] || '',
      fisio: r[idx['FISIO']] || '',
    }
    ;(byPatient.get(name) ?? byPatient.set(name, []).get(name)!).push(row)
  }

  const eventsByPatient = new Map<string, LedgerEvent[]>()
  for (const [name, patientRows] of byPatient) {
    patientRows.sort((a, b) => a.date.localeCompare(b.date))
    const events: LedgerEvent[] = []
    let current: LedgerRow[] = []
    const UNSETTLED = new Set(['DP', 'CICILAN'])
    for (const row of patientRows) {
      const prev = current[current.length - 1]
      // Only continue the same purchase event if the previous row left an
      // open balance (DP/CICILAN) and this row follows shortly after —
      // otherwise a monthly package renewal would get merged with the last
      // one just for landing within the gap window.
      const continues = prev && UNSETTLED.has(prev.ketBayar) && daysBetween(row.date, prev.date) <= EVENT_GAP_DAYS
      if (continues) {
        current.push(row)
      } else {
        if (current.length) events.push(buildEvent(name, current))
        current = [row]
      }
    }
    if (current.length) events.push(buildEvent(name, current))
    eventsByPatient.set(name, events)
  }
  return eventsByPatient
}

function buildEvent(name: string, rows: LedgerRow[]): LedgerEvent {
  const last = rows[rows.length - 1]
  const method = ALLOWED_PAYMENT_METHODS.has(last.metodeBayar) ? last.metodeBayar : null
  const statusMap: Record<string, string> = { LUNAS: 'LUNAS', PELUNASAN: 'PELUNASAN', DP: 'DP', CICILAN: 'DP' }
  return {
    patientName: name,
    startDate: rows[0].date,
    endDate: last.date,
    totalAmount: rows.reduce((s, r) => s + r.jumlahBayar, 0),
    harga: last.harga,
    discount: last.diskon,
    paymentMethod: method,
    paymentStatus: statusMap[last.ketBayar] ?? 'LUNAS',
    penjamin: [...rows].reverse().find(r => r.penjamin)?.penjamin || null,
    fisio: last.fisio || null,
    claimed: false,
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
interface Order {
  KODE: string; PASIEN: string; LAYANAN: string; 'DIBUAT TGL': string
  HARGA: string; DISKON: string; 'TOTAL BAYAR': string; 'STATUS BAYAR': string
}

const orders: Order[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'orders_with_sessions.json'), 'utf8'))
const ordersByKode = new Map(orders.map(o => [o.KODE, o]))
console.log(`Loaded ${orders.length} orders, mode: ${APPLY ? 'APPLY — will write' : 'DRY RUN — no writes'}`)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log('\nLoading ledger paket-purchase events from xlsx...')
  const ledgerEvents = loadLedgerPaketEvents()
  const totalEvents = [...ledgerEvents.values()].reduce((s, e) => s + e.length, 0)
  console.log(`  ${ledgerEvents.size} patients, ${totalEvents} purchase events (after installment grouping)`)

  console.log('\nFetching patients...')
  const patients = await fetchAll<{ id: string; encrypted_name: string; branch_id: string | null }>(
    supabase, 'patients', 'id, encrypted_name',
  )
  const idToName = new Map<string, string>()
  for (const p of patients) {
    if (p.encrypted_name) idToName.set(p.id, normName(decrypt(p.encrypted_name)))
  }

  console.log('Fetching patient_packages with a kode: note...')
  const packages = await fetchAll<{ id: string; patient_id: string; branch_id: string; package_name: string; notes: string | null }>(
    supabase, 'patient_packages', 'id, patient_id, branch_id, package_name, notes', (q) => q.like('notes', 'kode:%'),
  )
  console.log(`  ${packages.length} packages`)

  console.log('Fetching earliest completed visit per package...')
  const packageIds = packages.map(p => p.id)
  const visits: { id: string; package_id: string; visit_date: string; attending_staff_id: string | null }[] = []
  const ID_CHUNK = 150
  for (let i = 0; i < packageIds.length; i += ID_CHUNK) {
    const chunk = packageIds.slice(i, i + ID_CHUNK)
    const rows = await fetchAll<{ id: string; package_id: string; visit_date: string; attending_staff_id: string | null }>(
      supabase, 'patient_visits', 'id, package_id, visit_date, attending_staff_id', (q) => q.in('package_id', chunk).eq('status', 'completed'),
    )
    visits.push(...rows)
  }
  const firstVisitByPackage = new Map<string, { id: string; visit_date: string }>()
  for (const v of visits) {
    const cur = firstVisitByPackage.get(v.package_id)
    if (!cur || v.visit_date < cur.visit_date) firstVisitByPackage.set(v.package_id, { id: v.id, visit_date: v.visit_date })
  }

  console.log('Fetching existing package-sale transactions (to skip already-done packages)...')
  const existingTx = await fetchAll<{ visit_id: string | null; category: string }>(
    supabase, 'transactions', 'visit_id, category', (q) => q.in('category', ['PAKET KLINIK', 'PAKET VISIT']).neq('status', 'rejected'),
  )
  const visitsAlreadyPaid = new Set(existingTx.map(t => t.visit_id).filter(Boolean))

  const staffProfiles = ((await supabase.from('internal_profiles').select('id, full_name')).data ?? []) as { id: string; full_name: string }[]
  function matchTherapist(fisioName: string | null): string | null {
    if (!fisioName) return null
    const upper = fisioName.trim().toUpperCase()
    for (const p of staffProfiles) if (p.full_name.toUpperCase().split(/\s+/).some(w => w === upper)) return p.id
    return null
  }

  // ── Match each package to a ledger event ───────────────────────────────────
  type Planned = {
    visit_id: string; patient_id: string; branch_id: string; fisio_id: string | null
    category: string; harga: number; discount: number; amount: number
    payment_method: string | null; payment_status: string; penjamin: string | null
    transaction_date: string; description: string
  }
  const planned: Planned[] = []
  let skippedNoVisit = 0, skippedAlreadyPaid = 0, skippedNoOrder = 0, skippedZeroAmount = 0
  let matchedViaLedger = 0, fallbackViaOrder = 0

  // Group packages by patient, sort by order's DIBUAT TGL so pairing is chronological.
  const packagesByPatient = new Map<string, typeof packages>()
  for (const pkg of packages) (packagesByPatient.get(pkg.patient_id) ?? packagesByPatient.set(pkg.patient_id, []).get(pkg.patient_id)!).push(pkg)

  for (const [patientId, pkgs] of packagesByPatient) {
    const name = idToName.get(patientId)
    const events = name ? (ledgerEvents.get(name) ?? []) : []

    const withOrder = pkgs
      .map(pkg => {
        const kode = pkg.notes?.replace('kode:', '') ?? ''
        return { pkg, order: ordersByKode.get(kode) ?? null }
      })
      .filter(x => x.order !== null) as { pkg: typeof pkgs[number]; order: Order }[]

    skippedNoOrder += pkgs.length - withOrder.length
    withOrder.sort((a, b) => (parseDmyDash(a.order['DIBUAT TGL']) ?? '').localeCompare(parseDmyDash(b.order['DIBUAT TGL']) ?? ''))

    for (const { pkg, order } of withOrder) {
      const firstVisit = firstVisitByPackage.get(pkg.id)
      if (!firstVisit) { skippedNoVisit++; continue }
      if (visitsAlreadyPaid.has(firstVisit.id)) { skippedAlreadyPaid++; continue }

      const orderAmount = parseRp(order['TOTAL BAYAR'])
      const orderHarga = parseRp(order.HARGA)
      const orderDiscount = parseRp(order.DISKON)
      const orderDate = parseDmyDash(order['DIBUAT TGL']) ?? firstVisit.visit_date

      // Find best unclaimed ledger event: amount matches order total, date within window.
      let best: LedgerEvent | null = null
      let bestDelta = Infinity
      for (const ev of events) {
        if (ev.claimed) continue
        if (ev.totalAmount !== orderAmount) continue
        const delta = daysBetween(ev.startDate, orderDate)
        if (delta <= MATCH_WINDOW_DAYS && delta < bestDelta) { best = ev; bestDelta = delta }
      }

      const amount = orderAmount
      if (amount <= 0) { skippedZeroAmount++; continue }

      const category = /VISIT/.test(order.LAYANAN ?? pkg.package_name ?? '') ? 'PAKET VISIT' : 'PAKET KLINIK'

      if (best) {
        best.claimed = true
        matchedViaLedger++
        planned.push({
          visit_id: firstVisit.id, patient_id: patientId, branch_id: pkg.branch_id,
          fisio_id: matchTherapist(best.fisio) ?? firstVisit.attending_staff_id,
          category, harga: orderHarga, discount: orderDiscount, amount,
          payment_method: best.paymentMethod, payment_status: best.paymentStatus, penjamin: best.penjamin,
          transaction_date: best.startDate,
          description: `Impor data historis (KODE: ${order.KODE}) · dicocokkan dgn buku kas`,
        })
      } else {
        fallbackViaOrder++
        const paymentStatus = order['STATUS BAYAR'] === 'Lunas' ? 'LUNAS' : 'DP'
        planned.push({
          visit_id: firstVisit.id, patient_id: patientId, branch_id: pkg.branch_id,
          fisio_id: firstVisit.attending_staff_id,
          category, harga: orderHarga, discount: orderDiscount, amount,
          payment_method: null, payment_status: paymentStatus, penjamin: null,
          transaction_date: orderDate,
          description: `Impor data historis (KODE: ${order.KODE}) · tanggal dari sistem order (tidak ditemukan di buku kas)`,
        })
      }
    }
  }

  const totalAmount = planned.reduce((s, p) => s + p.amount, 0)
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Matching summary:
  Packages total:                ${packages.length}
  Skipped (no order for KODE):   ${skippedNoOrder}
  Skipped (no completed visit):  ${skippedNoVisit}
  Skipped (already has tx):      ${skippedAlreadyPaid}
  Skipped (zero amount):         ${skippedZeroAmount}
  Matched via ledger (precise):  ${matchedViaLedger}
  Fallback via order date only:  ${fallbackViaOrder}
  Transactions to insert:        ${planned.length}
  Total amount:                  Rp${totalAmount.toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  const debugPatientId = process.env.DEBUG_PATIENT_ID
  if (debugPatientId) {
    console.log(`\nDebug — planned rows for patient ${debugPatientId}:`)
    for (const p of planned.filter(p => p.patient_id === debugPatientId)) console.log(JSON.stringify(p, null, 2))
  }

  console.log('Sample (ledger-matched):')
  for (const p of planned.filter(p => p.description.includes('dicocokkan')).slice(0, 8)) {
    console.log(`  ${p.transaction_date}  ${p.category.padEnd(12)}  harga=${p.harga} amount=${p.amount}  method=${p.payment_method}  status=${p.payment_status}`)
  }
  console.log('Sample (order-fallback):')
  for (const p of planned.filter(p => !p.description.includes('dicocokkan')).slice(0, 8)) {
    console.log(`  ${p.transaction_date}  ${p.category.padEnd(12)}  harga=${p.harga} amount=${p.amount}`)
  }

  if (!APPLY) {
    console.log('\nDry run only — re-run with --apply to write these rows.')
    return
  }

  console.log(`\nInserting ${planned.length} transactions...`)
  const CHUNK = 200
  let inserted = 0
  for (let i = 0; i < planned.length; i += CHUNK) {
    const chunk = planned.slice(i, i + CHUNK).map(p => ({
      visit_id: p.visit_id, patient_id: p.patient_id, branch_id: p.branch_id, fisio_id: p.fisio_id,
      type: 'income', category: p.category, harga: p.harga, discount: p.discount, amount: p.amount,
      payment_method: p.payment_method, payment_status: p.payment_status, penjamin: p.penjamin,
      description: p.description, transaction_date: p.transaction_date, status: 'confirmed', recorded_by: null,
    }))
    const { error } = await supabase.from('transactions').insert(chunk)
    if (error) { console.error(`  FAIL chunk ${i}-${i + chunk.length}: ${error.message}`); continue }
    inserted += chunk.length
    console.log(`  inserted ${inserted}/${planned.length}`)
  }
  console.log(`\nDone. Inserted ${inserted}/${planned.length} transactions.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
