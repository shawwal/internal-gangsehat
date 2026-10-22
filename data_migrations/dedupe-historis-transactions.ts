/**
 * Remove income transactions double-counted by the 2026-07-25 backfill
 * ("Impor data historis (KODE: TRX/...)", from backfill-visit-transactions.ts /
 * backfill-package-transactions.ts) on top of the 2026-06-25 ledger import
 * (import-transactions-finance.mts, CATATAN KEUANGAN FGS PTK 2026.xlsx).
 *
 * Up to LEDGER_CUTOFF the ledger import is authoritative (its monthly totals
 * equal the "LAPORAN LABA RUGI" PDF), so EVERY historis row in that range is
 * removed. Its link fields are first moved onto the best ledger row:
 *   1. exact twin: same patient + date + amount + category
 *   2. ledger row with no patient link, same date + amount + category
 *      (the ledger import left ~220 rows unlinked — this also sets patient_id)
 *   3. nearest same-patient same-category ledger row within 60 days that has
 *      no visit yet (link transfer only — e.g. full package price vs DP+lunas)
 *
 * After LEDGER_CUTOFF there is no ledger import, so only exact twins of
 * app-entered rows are removed; other historis rows are kept and listed in
 * dedupe-historis-unmatched.csv.
 *
 * Moved fields: visit_id / fisio_id / order_id (keeps "Nominal Dibayar" and
 * package links working). Affiliate/reward point rows are repointed.
 *
 * Default is a DRY RUN (no writes). Pass --apply to actually write.
 *
 * Run with: npx tsx data_migrations/dedupe-historis-transactions.ts [--apply]
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── env ──────────────────────────────────────────────────────────────────────
for (const file of ['../.env', '../.env.local']) {
  const envPath = path.join(__dirname, file)
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const BRANCH_ID   = 'cfe27e13-ba0b-440d-99f3-03e059efb877' // Fisioterapi Gang Sehat Pontianak
const DATE_FROM   = '2026-01-01'
const DATE_TO     = '2026-08-01' // exclusive
const HISTORIS    = 'Impor data historis'
const LEDGER_CUTOFF = '2026-06-15' // last transaction_date of the 2026-06-25 ledger import
const UNMATCHED_CSV = path.join(__dirname, 'dedupe-historis-unmatched.csv')

interface Tx {
  id: string
  patient_id: string | null
  visit_id: string | null
  fisio_id: string | null
  order_id: string | null
  category: string
  amount: number
  status: string
  transaction_date: string
  description: string | null
  recorded_by: string | null
  created_at: string
}

async function fetchAll(): Promise<Tx[]> {
  const rows: Tx[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, patient_id, visit_id, fisio_id, order_id, category, amount, status, transaction_date, description, recorded_by, created_at')
      .eq('branch_id', BRANCH_ID)
      .eq('type', 'income')
      .gte('transaction_date', DATE_FROM)
      .lt('transaction_date', DATE_TO)
      .neq('status', 'rejected')
      .order('created_at')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data as Tx[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

const keyOf = (t: Tx) => [t.patient_id, t.transaction_date, Number(t.amount), t.category].join('|')
const isHistoris = (t: Tx) => (t.description ?? '').startsWith(HISTORIS)
const fmt = (n: number) => n.toLocaleString('id-ID')

async function main() {
  console.log(APPLY ? '*** APPLY MODE — writing changes ***' : '--- DRY RUN (pass --apply to write) ---')
  const rows = await fetchAll()
  const historis = rows.filter(isHistoris)
  const keepers  = rows.filter(t => !isHistoris(t))

  // Pool of keeper rows per key; each can absorb at most one historis duplicate.
  const pool = new Map<string, Tx[]>()
  const unlinkedPool = new Map<string, Tx[]>() // ledger rows with no patient, keyed without patient
  const looseKey = (t: Tx) => [t.transaction_date, Number(t.amount), t.category].join('|')
  for (const t of keepers) {
    const map = t.patient_id ? pool : unlinkedPool
    const k = t.patient_id ? keyOf(t) : looseKey(t)
    map.set(k, [...(map.get(k) ?? []), t])
  }
  const visitClaimed = new Set(keepers.filter(t => t.visit_id).map(t => t.id))
  const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5

  const pairs: { dup: Tx; keep: Tx | null; setPatient: boolean }[] = []
  const unmatched: Tx[] = []
  for (const h of historis) {
    const exact = h.patient_id ? pool.get(keyOf(h))?.shift() : undefined
    if (exact) { pairs.push({ dup: h, keep: exact, setPatient: false }); continue }
    if (h.transaction_date > LEDGER_CUTOFF) { unmatched.push(h); continue }

    const unlinked = unlinkedPool.get(looseKey(h))?.shift()
    if (unlinked) { pairs.push({ dup: h, keep: unlinked, setPatient: !!h.patient_id }); continue }

    const near = keepers
      .filter(k => k.patient_id && k.patient_id === h.patient_id && k.category === h.category
        && k.transaction_date <= LEDGER_CUTOFF && !visitClaimed.has(k.id) && days(k.transaction_date, h.transaction_date) <= 60)
      .sort((a, b) => days(a.transaction_date, h.transaction_date) - days(b.transaction_date, h.transaction_date))[0]
    pairs.push({ dup: h, keep: near ?? null, setPatient: false })
    if (near) visitClaimed.add(near.id)
  }

  // Report per month
  const months = new Map<string, { dupN: number; dupAmt: number; unN: number; unAmt: number }>()
  const bump = (t: Tx, field: 'dup' | 'un') => {
    const m = t.transaction_date.slice(0, 7)
    const s = months.get(m) ?? { dupN: 0, dupAmt: 0, unN: 0, unAmt: 0 }
    if (field === 'dup') { s.dupN++; s.dupAmt += Number(t.amount) } else { s.unN++; s.unAmt += Number(t.amount) }
    months.set(m, s)
  }
  pairs.forEach(p => bump(p.dup, 'dup'))
  unmatched.forEach(t => bump(t, 'un'))
  console.log('\nmonth    | duplicates to delete       | unmatched historis (kept)')
  for (const [m, s] of [...months].sort()) {
    console.log(`${m}  | ${String(s.dupN).padStart(4)}  Rp${fmt(s.dupAmt).padStart(14)} | ${String(s.unN).padStart(4)}  Rp${fmt(s.unAmt).padStart(14)}`)
  }
  const after = new Map<string, number>()
  const removed = new Set(pairs.map(p => p.dup.id))
  for (const t of rows) if (!removed.has(t.id)) after.set(t.transaction_date.slice(0, 7), (after.get(t.transaction_date.slice(0, 7)) ?? 0) + Number(t.amount))
  console.log('\nmonth    | income total after cleanup')
  for (const [m, a] of [...after].sort()) console.log(`${m}  | Rp${fmt(a).padStart(14)}`)
  console.log(`\nTotal duplicates: ${pairs.length} (Rp${fmt(pairs.reduce((a, p) => a + Number(p.dup.amount), 0))})`)
  console.log(`Total unmatched historis: ${unmatched.length} → ${path.basename(UNMATCHED_CSV)}`)

  const csv = ['id,transaction_date,category,amount,patient_id,visit_id,description']
  for (const t of unmatched) {
    csv.push([t.id, t.transaction_date, t.category, t.amount, t.patient_id ?? '', t.visit_id ?? '', `"${(t.description ?? '').replace(/"/g, '""')}"`].join(','))
  }
  fs.writeFileSync(UNMATCHED_CSV, csv.join('\n'))

  if (!APPLY) return

  let merged = 0, deleted = 0
  for (const { dup, keep, setPatient } of pairs) {
    if (!keep) {
      const { error } = await supabase.from('transactions').delete().eq('id', dup.id)
      if (error) throw error
      deleted++
      continue
    }
    const patch: Partial<Tx> = {}
    if (setPatient) patch.patient_id = dup.patient_id
    if (!keep.visit_id && dup.visit_id) patch.visit_id = dup.visit_id
    if (!keep.fisio_id && dup.fisio_id) patch.fisio_id = dup.fisio_id
    if (!keep.order_id && dup.order_id) patch.order_id = dup.order_id

    // The keeper's visit_id must not be claimed twice; free it on the dup first.
    if (Object.keys(patch).length) {
      const { error: clearErr } = await supabase.from('transactions').update({ visit_id: null, order_id: null }).eq('id', dup.id)
      if (clearErr) throw clearErr
      const { error } = await supabase.from('transactions').update(patch).eq('id', keep.id)
      if (error) throw error
      merged++
    }

    for (const table of ['affiliate_points', 'reward_points']) {
      const { error } = await supabase.from(table).update({ transaction_id: keep.id }).eq('transaction_id', dup.id)
      if (error) throw error
    }

    const { error: delErr } = await supabase.from('transactions').delete().eq('id', dup.id)
    if (delErr) throw delErr
    deleted++
    if (deleted % 100 === 0) console.log(`  … ${deleted}/${pairs.length}`)
  }
  console.log(`\nDone: merged links into ${merged} rows, deleted ${deleted} duplicates.`)
}

main().catch(err => { console.error(err); process.exit(1) })
