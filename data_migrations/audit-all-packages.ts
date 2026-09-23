/**
 * Read-only audit of every PAKET package against the frozen legacy export
 * (orders_with_sessions.json — the legacy site is retired, so this file is the
 * permanent source of truth for everything migrated by full-reset-reimport.ts).
 *
 * Makes no writes. Prints a summary to the console and writes the full itemized
 * findings to data_migrations/audit-report-<date>.md for review.
 *
 * Checks, per PAKET order / patient_packages row:
 *   1. Orphan visit rows   — DB rows from the migration batch window that match
 *                            no session in the order's source data.
 *   2. Missing sessions    — source sessions with no matching DB row.
 *   3. Status mismatches   — legacy STATUS vs current patient_packages.status.
 *   4. Orphaned orders     — PAKET orders with a kode but no matching package.
 *   5. Unverifiable pkgs   — packages with no kode: note (just counted).
 *
 * Run with: npx tsx data_migrations/audit-all-packages.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

for (const envFile of ['../.env', '../.env.local']) {
  const envPath = path.join(__dirname, envFile)
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// full-reset-reimport.ts inserted its rows between 00:41:59 and ~00:45 UTC on
// 2026-07-16; staff started using the app live from 02:28 the same day. Matching
// on date alone would sweep up real visits, so the window has to be the batch itself.
const BATCH_START = Date.parse('2026-07-16T00:00:00Z')
const BATCH_END   = Date.parse('2026-07-16T01:00:00Z')
function isMigrationBatchRow(createdAt: string): boolean {
  const t = Date.parse(createdAt)
  return t >= BATCH_START && t < BATCH_END
}

interface Session { PERTEMUAN: string; TANGGAL: string; JAM: string; STATUS_SESI: string; 'NOMINAL BAYAR': string }
interface Order { KODE: string; PASIEN: string; LAYANAN: string; STATUS: string; sessions: Session[] }

function parseDate(dmy: string): string | null {
  if (!dmy) return null
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function doneSessions(sessions: Session[]): Session[] {
  return (sessions ?? []).filter(
    s => s['NOMINAL BAYAR'] === 'Sudah Ditangani' || s.STATUS_SESI === 'Hadir' || s.STATUS_SESI === 'Tidak Hadir'
  )
}

function sessionKey(visitDate: string, jam: string | null): string {
  const j = jam && jam !== '-' ? jam.slice(0, 5) : 'NULL'
  return `${visitDate}::${j}`
}

function expectedStatus(legacyStatus: string): string {
  if (legacyStatus === 'Proses' || legacyStatus === 'Booking') return 'active'
  if (legacyStatus === 'Stop') return 'stopped'
  return 'completed' // Selesai, Evaluasi
}

// supabase/054-package-stop-and-active-guard.sql reconciled "1 active package
// per patient" by force-stopping every non-newest active package, in one UPDATE
// with this exact updated_at — a real, intentional data-integrity fix, not a bug.
// Status mismatches produced by it aren't migration artifacts and shouldn't be
// reported as unexplained.
const MIGRATION_054_TIMESTAMP = '2026-08-10T07:47:34.013265+00:00'

const orders: Order[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'orders_with_sessions.json'), 'utf8'))
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const PAGE = 1000
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function main() {
  console.log(`Loaded ${orders.length} orders from orders_with_sessions.json`)

  const packages = await fetchAll<{ id: string; patient_id: string; notes: string | null; status: string; updated_at: string }>(
    'patient_packages', 'id, patient_id, notes, status, updated_at')
  const visits = await fetchAll<{ id: string; package_id: string | null; visit_date: string; visit_time: string | null; created_at: string }>(
    'patient_visits', 'id, package_id, visit_date, visit_time, created_at')
  console.log(`Loaded ${packages.length} packages, ${visits.length} visits\n`)

  // ── Duplicate kode notes ────────────────────────────────────────────────────
  // More than one patient_packages row claiming the same source order is never
  // legitimate — the Map lookup below would otherwise silently keep only one
  // (last-write-wins) and hide this class of bug entirely.
  const kodeGroups = new Map<string, { id: string; patient_id: string; status: string }[]>()
  for (const p of packages) {
    const m = p.notes?.match(/kode:(\S+)/)
    if (!m) continue
    if (!kodeGroups.has(m[1])) kodeGroups.set(m[1], [])
    kodeGroups.get(m[1])!.push({ id: p.id, patient_id: p.patient_id, status: p.status })
  }
  const duplicateKodes = [...kodeGroups.entries()].filter(([, rows]) => rows.length > 1)

  const pkgByKode = new Map<string, { id: string; status: string; updated_at: string }>()
  for (const p of packages) {
    const m = p.notes?.match(/kode:(\S+)/)
    if (m) pkgByKode.set(m[1], { id: p.id, status: p.status, updated_at: p.updated_at })
  }
  const visitsByPkg = new Map<string, typeof visits>()
  for (const v of visits) {
    if (!v.package_id) continue
    if (!visitsByPkg.has(v.package_id)) visitsByPkg.set(v.package_id, [])
    visitsByPkg.get(v.package_id)!.push(v)
  }

  const orphanRows: { kode: string; pasien: string; visitDate: string; visitTime: string | null }[] = []
  const missingSessions: { kode: string; pasien: string; visitDate: string; jam: string }[] = []
  const statusMismatches: { kode: string; pasien: string; legacyStatus: string; dbStatus: string; expected: string }[] = []
  const explainedByMigration054: { kode: string; pasien: string; legacyStatus: string; dbStatus: string }[] = []
  const orphanedOrders: { kode: string; pasien: string; layanan: string; status: string; attendedCount: number }[] = []

  const paketOrders = orders.filter(o => o.LAYANAN?.toUpperCase().startsWith('PAKET'))

  for (const order of paketOrders) {
    const pkg = pkgByKode.get(order.KODE)
    const attended = doneSessions(order.sessions)

    if (!pkg) {
      orphanedOrders.push({ kode: order.KODE, pasien: order.PASIEN, layanan: order.LAYANAN, status: order.STATUS, attendedCount: attended.length })
      continue
    }

    const sourceKeys = new Set<string>()
    for (const s of attended) {
      const d = parseDate(s.TANGGAL)
      if (d) sourceKeys.add(sessionKey(d, s.JAM))
    }

    const rows = visitsByPkg.get(pkg.id) ?? []
    const dbKeys = new Set(rows.map(r => sessionKey(r.visit_date, r.visit_time)))

    for (const row of rows) {
      if (!isMigrationBatchRow(row.created_at)) continue
      if (sourceKeys.has(sessionKey(row.visit_date, row.visit_time))) continue
      orphanRows.push({ kode: order.KODE, pasien: order.PASIEN, visitDate: row.visit_date, visitTime: row.visit_time })
    }

    for (const s of attended) {
      const d = parseDate(s.TANGGAL)
      if (!d) continue
      if (!dbKeys.has(sessionKey(d, s.JAM))) {
        missingSessions.push({ kode: order.KODE, pasien: order.PASIEN, visitDate: d, jam: s.JAM })
      }
    }

    const expected = expectedStatus(order.STATUS)
    if (pkg.status !== expected) {
      if (pkg.updated_at === MIGRATION_054_TIMESTAMP) {
        explainedByMigration054.push({ kode: order.KODE, pasien: order.PASIEN, legacyStatus: order.STATUS, dbStatus: pkg.status })
      } else {
        statusMismatches.push({ kode: order.KODE, pasien: order.PASIEN, legacyStatus: order.STATUS, dbStatus: pkg.status, expected })
      }
    }
  }

  const unverifiablePkgs = packages.filter(p => !p.notes?.match(/kode:(\S+)/))

  // ── Console summary ──────────────────────────────────────────────────────────
  console.log('── Summary ──')
  console.log(`1. Orphan visit rows (migration-batch duplicates):  ${orphanRows.length}`)
  console.log(`2. Missing sessions (source has, DB doesn't):       ${missingSessions.length}`)
  console.log(`3. Status mismatches (legacy STATUS vs DB status):  ${statusMismatches.length}  (+ ${explainedByMigration054.length} explained by the 2026-08-10 active-package-guard migration, not shown as issues)`)
  const orphanedConcerningCount = orphanedOrders.filter(o => (o.status === 'Selesai' || o.status === 'Evaluasi') && o.attendedCount > 0).length
  console.log(`4. Orphaned orders (kode with no matching package): ${orphanedOrders.length}  (${orphanedConcerningCount} concerning — finished with real sessions, ${orphanedOrders.length - orphanedConcerningCount} likely benign — in-progress at cutover)`)
  console.log(`5. Unverifiable packages (no kode: note):           ${unverifiablePkgs.length} (informational only, not itemized)`)
  console.log(`6. Duplicate kode notes (>1 package per order):     ${duplicateKodes.length}`)
  if (duplicateKodes.length) {
    console.log('\nDuplicate kode notes:')
    for (const [kode, rows] of duplicateKodes) {
      console.log(`  ${kode}: ${rows.length} package rows across ${new Set(rows.map(r => r.patient_id)).size} distinct patient_id(s)`)
      for (const r of rows) console.log(`    pkg=${r.id} patient=${r.patient_id} status=${r.status}`)
    }
  }

  if (statusMismatches.length) {
    const byTransition = new Map<string, number>()
    for (const s of statusMismatches) {
      const k = `legacy "${s.legacyStatus}" -> db "${s.dbStatus}" (expected "${s.expected}")`
      byTransition.set(k, (byTransition.get(k) ?? 0) + 1)
    }
    console.log('\nStatus mismatch breakdown:')
    for (const [k, count] of [...byTransition.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}x  ${k}`)
    }
  }

  // ── Write full report ─────────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10)
  const reportPath = path.join(__dirname, `audit-report-${dateStr}.md`)
  const lines: string[] = []
  lines.push(`# Package data audit — ${dateStr}`)
  lines.push('')
  lines.push(`Read-only audit of ${paketOrders.length} PAKET orders against ${packages.length} patient_packages rows.`)
  lines.push('')
  lines.push(`| Category | Count |`)
  lines.push(`|---|---|`)
  lines.push(`| Orphan visit rows | ${orphanRows.length} |`)
  lines.push(`| Missing sessions | ${missingSessions.length} |`)
  lines.push(`| Status mismatches (unexplained) | ${statusMismatches.length} |`)
  lines.push(`| Status changes explained by the 2026-08-10 active-guard migration | ${explainedByMigration054.length} |`)
  lines.push(`| Orphaned orders (no matching package) | ${orphanedOrders.length} |`)
  lines.push(`| Unverifiable packages (no kode note) | ${unverifiablePkgs.length} |`)
  lines.push(`| Duplicate kode notes (>1 package per order) | ${duplicateKodes.length} |`)
  lines.push('')

  lines.push('## 1. Orphan visit rows')
  lines.push('')
  lines.push('DB rows created in the original migration batch window that match no session in the source order.')
  lines.push('')
  if (orphanRows.length) {
    lines.push('| Kode | Pasien | Visit date | Visit time |')
    lines.push('|---|---|---|---|')
    for (const o of orphanRows) lines.push(`| ${o.kode} | ${o.pasien} | ${o.visitDate} | ${o.visitTime ?? '-'} |`)
  } else {
    lines.push('None found.')
  }
  lines.push('')

  lines.push('## 2. Missing sessions')
  lines.push('')
  lines.push('Source sessions with no matching visit row in the DB.')
  lines.push('')
  if (missingSessions.length) {
    lines.push('| Kode | Pasien | Visit date | Jam |')
    lines.push('|---|---|---|---|')
    for (const m of missingSessions) lines.push(`| ${m.kode} | ${m.pasien} | ${m.visitDate} | ${m.jam} |`)
  } else {
    lines.push('None found.')
  }
  lines.push('')

  lines.push('## 3. Status mismatches')
  lines.push('')
  lines.push('Legacy STATUS vs current patient_packages.status (mapping: Booking/Proses→active, Stop→stopped, Selesai/Evaluasi→completed). Excludes rows explained by the 2026-08-10 active-guard migration (listed separately below) — those are an intentional data-integrity fix, not a bug.')
  lines.push('')
  if (statusMismatches.length) {
    lines.push('| Kode | Pasien | Legacy STATUS | DB status | Expected |')
    lines.push('|---|---|---|---|---|')
    for (const s of statusMismatches) lines.push(`| ${s.kode} | ${s.pasien} | ${s.legacyStatus} | ${s.dbStatus} | ${s.expected} |`)
  } else {
    lines.push('None found.')
  }
  lines.push('')
  lines.push('### 3a. Explained by the 2026-08-10 active-guard migration')
  lines.push('')
  lines.push('`supabase/054-package-stop-and-active-guard.sql` force-stopped every non-newest active package per patient, in one UPDATE — a real, intentional data-integrity fix (patients previously could end up with multiple simultaneously "active" packages). These read as mismatches against the frozen legacy STATUS, but are correct as-is.')
  lines.push('')
  if (explainedByMigration054.length) {
    lines.push('| Kode | Pasien | Legacy STATUS | DB status |')
    lines.push('|---|---|---|---|')
    for (const s of explainedByMigration054) lines.push(`| ${s.kode} | ${s.pasien} | ${s.legacyStatus} | ${s.dbStatus} |`)
  } else {
    lines.push('None found.')
  }
  lines.push('')

  const orphanedConcerning = orphanedOrders.filter(o => (o.status === 'Selesai' || o.status === 'Evaluasi') && o.attendedCount > 0)
  const orphanedBenign = orphanedOrders.filter(o => !((o.status === 'Selesai' || o.status === 'Evaluasi') && o.attendedCount > 0))

  lines.push('## 4. Orphaned orders (no matching package)')
  lines.push('')
  lines.push('PAKET orders whose kode has no corresponding patient_packages row at all.')
  lines.push('')
  lines.push(`### 4a. Concerning — finished orders with real session history, entirely missing (${orphanedConcerning.length})`)
  lines.push('')
  lines.push('Legacy STATUS is Selesai/Evaluasi (the order was finished) and it has attended sessions, but no package exists at all in the new system. Likely genuine data loss — worth creating these packages manually.')
  lines.push('')
  if (orphanedConcerning.length) {
    lines.push('| Kode | Pasien | Layanan | Legacy STATUS | Attended sessions |')
    lines.push('|---|---|---|---|---|')
    for (const o of orphanedConcerning) lines.push(`| ${o.kode} | ${o.pasien} | ${o.layanan} | ${o.status} | ${o.attendedCount} |`)
  } else {
    lines.push('None found.')
  }
  lines.push('')
  lines.push(`### 4b. Likely benign — in-progress at cutover, probably continued live (${orphanedBenign.length})`)
  lines.push('')
  lines.push('Legacy STATUS is Booking/Proses (or a Selesai/Evaluasi/Stop order with 0 attended sessions) — most of these cluster right around the 2026-07-16 migration cutoff date, consistent with the order having been picked up and continued directly in the new app instead of the old one.')
  lines.push('')
  if (orphanedBenign.length) {
    lines.push('| Kode | Pasien | Layanan | Legacy STATUS | Attended sessions |')
    lines.push('|---|---|---|---|---|')
    for (const o of orphanedBenign) lines.push(`| ${o.kode} | ${o.pasien} | ${o.layanan} | ${o.status} | ${o.attendedCount} |`)
  } else {
    lines.push('None found.')
  }
  lines.push('')

  lines.push('## 5. Duplicate kode notes')
  lines.push('')
  lines.push('More than one `patient_packages` row claiming the same source order. Never legitimate on its own — investigate the underlying patient records for each case; two different `patient_id`s sharing a kode most likely means two duplicate `patients` rows for the same real person (found once already: see report notes / chat).')
  lines.push('')
  if (duplicateKodes.length) {
    lines.push('| Kode | Package ID | Patient ID | Status |')
    lines.push('|---|---|---|---|')
    for (const [kode, rows] of duplicateKodes) {
      for (const r of rows) lines.push(`| ${kode} | ${r.id} | ${r.patient_id} | ${r.status} |`)
    }
  } else {
    lines.push('None found.')
  }
  lines.push('')

  lines.push('## 6. Unverifiable packages')
  lines.push('')
  lines.push(`${unverifiablePkgs.length} packages have no \`kode:\` note, so they can't be cross-checked against the legacy export. These are expected to be packages created directly in the app after launch — not itemized here.`)
  lines.push('')

  fs.writeFileSync(reportPath, lines.join('\n'))
  console.log(`\nFull report written to ${reportPath}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
