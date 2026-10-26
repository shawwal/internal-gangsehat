/**
 * Relabel installment payments that were entered as a second (third, …) "DP"
 * to CICILAN (migration 116 must be applied first).
 *
 * Before CICILAN existed, staff could only pick LUNAS / DP / PELUNASAN, so a
 * package paid in four parts reads DP, DP, DP, PELUNASAN. Only the first DP is
 * the sale; the KPIs already skip the rest (lib/metrics/achievement
 * `countedSaleIds`). This script uses that same rule, so it only renames rows
 * the counts already ignore — Target Progress, PFOTM and payroll numbers stay
 * the same before and after.
 *
 * Also lists, without changing them, rows a human should look at:
 *   - "LUNAS" rows that only pay the remainder of an open DP on the same order
 *     (probably meant PELUNASAN)
 *   - installment rows with no Status Bayar (older settle-dialog payments)
 *
 * Rows inside a locked PFOTM period or a non-draft payroll period are skipped
 * and listed.
 *
 * Defaults to DRY RUN. Pass --apply to write; --branch=<uuid> to limit.
 *
 *   npx tsx data_migrations/dp-installments-to-cicilan.ts                 # dry run, all branches
 *   npx tsx data_migrations/dp-installments-to-cicilan.ts --branch=<id>   # dry run, one branch
 *   npx tsx data_migrations/dp-installments-to-cicilan.ts --apply         # writes
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { countedSaleIds, type SalePayment } from '../lib/metrics/achievement'

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

const APPLY  = process.argv.includes('--apply')
const BRANCH = process.argv.find((a) => a.startsWith('--branch='))?.slice('--branch='.length) ?? null
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

type Row = SalePayment & { branch_id: string; order_id: string | null }

async function loadIncome(): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('transactions')
      .select('id, branch_id, patient_id, order_id, category, payment_status, transaction_date, created_at, harga, discount, amount')
      .eq('type', 'income')
      .neq('status', 'rejected')
      .order('id')
      .range(from, from + 999)
    if (BRANCH) q = q.eq('branch_id', BRANCH)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function lockedRanges() {
  const [{ data: pfotm }, { data: payroll }] = await Promise.all([
    supabase.from('pfotm_periods').select('branch_id, start_date, end_date').eq('is_locked', true),
    supabase.from('payroll_periods').select('branch_id, start_date, end_date, status').neq('status', 'draft'),
  ])
  return [
    ...(pfotm ?? []).map((p) => ({ ...p, kind: 'PFOTM locked' })),
    ...(payroll ?? []).map((p) => ({ ...p, kind: `payroll ${p.status}` })),
  ] as { branch_id: string; start_date: string; end_date: string; kind: string }[]
}

const rp = (n: number | null) => `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`
const line = (r: Row) => `${r.id.slice(0, 8)} ${r.transaction_date} ${r.category.padEnd(14)} ${rp(r.harga).padStart(13)} paid ${rp(r.amount)}`

async function main() {
  console.log(APPLY ? '== APPLY ==' : '== DRY RUN (pass --apply to write) ==')
  const rows = await loadIncome()
  const counted = countedSaleIds(rows)

  const toCicilan = rows.filter((r) => r.payment_status === 'DP' && !counted.has(r.id))

  // Review-only: a LUNAS paying just the remainder of the same order's open DP.
  const firstByOrder = new Map<string, Row>()
  for (const r of [...rows].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))) {
    if (r.order_id && !firstByOrder.has(r.order_id)) firstByOrder.set(r.order_id, r)
  }
  const closingLunas = rows.filter((r) => {
    const first = r.order_id ? firstByOrder.get(r.order_id) : undefined
    return r.payment_status === 'LUNAS' && first && first.id !== r.id && first.payment_status === 'DP'
      && Number(r.amount ?? 0) + Number(r.discount ?? 0) < Number(r.harga ?? 0)
  })
  const noStatus = rows.filter((r) => r.payment_status == null && r.order_id && firstByOrder.get(r.order_id)?.id !== r.id)

  const locks = await lockedRanges()
  const lockOf = (r: Row) => locks.find((l) => l.branch_id === r.branch_id && r.transaction_date >= l.start_date && r.transaction_date <= l.end_date)
  const skipped = toCicilan.filter(lockOf)
  const apply = toCicilan.filter((r) => !lockOf(r))

  console.log(`\nDP installments → CICILAN: ${apply.length}`)
  for (const r of apply) console.log('  ' + line(r))
  if (skipped.length) {
    console.log(`\nSkipped (inside a locked period): ${skipped.length}`)
    for (const r of skipped) console.log(`  ${line(r)}  — ${lockOf(r)!.kind} ${lockOf(r)!.start_date}..${lockOf(r)!.end_date}`)
  }

  if (APPLY && apply.length) {
    for (let i = 0; i < apply.length; i += 200) {
      const { error } = await supabase
        .from('transactions')
        .update({ payment_status: 'CICILAN' })
        .in('id', apply.slice(i, i + 200).map((r) => r.id))
        .eq('payment_status', 'DP') // untouched since this run read it
      if (error) throw new Error(error.message)
    }
    console.log(`\nUpdated ${apply.length} transaction(s).`)
  }

  console.log('\n[For review — not changed by this script]')
  console.log(`  LUNAS that only pays the rest of an open DP (probably PELUNASAN): ${closingLunas.length}`)
  for (const r of closingLunas) console.log('    ' + line(r))
  console.log(`  Installments with no Status Bayar: ${noStatus.length}`)
  for (const r of noStatus) console.log('    ' + line(r))
}

main().catch((e) => { console.error(e); process.exit(1) })
