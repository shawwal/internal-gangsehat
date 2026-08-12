/**
 * Backfill `transactions` rows that are fully paid (payment_status = 'LUNAS')
 * but stuck in `status = 'pending'` because they predate the auto-confirm-on-
 * LUNAS fix in app/actions/transactions.ts (createTransactionForVisit /
 * createTransactionManual). Without this, historical Progress Target numbers
 * (e.g. TA counts) undercount days where payments were fully collected but
 * never manually confirmed via the finance Konfirmasi button.
 *
 * Default is a DRY RUN (reports counts only). Pass --apply to actually update.
 *
 * Run with: npx tsx data_migrations/backfill-lunas-confirm.ts [--apply]
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
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

const APPLY = process.argv.includes('--apply')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id, branch_id, category, recorded_by, transaction_date, branches!branch_id(name)')
    .eq('type', 'income')
    .eq('payment_status', 'LUNAS')
    .eq('status', 'pending')

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  const total = rows?.length ?? 0
  console.log(`Found ${total} pending-but-LUNAS income transactions.\n`)

  if (total === 0) {
    console.log('Nothing to backfill.')
    return
  }

  const byBranch = new Map<string, number>()
  const byCategory = new Map<string, number>()
  for (const r of rows!) {
    const branchName = (r as any).branches?.name ?? r.branch_id ?? 'unknown'
    byBranch.set(branchName, (byBranch.get(branchName) ?? 0) + 1)
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1)
  }

  console.log('By branch:')
  for (const [k, v] of [...byBranch.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)
  console.log('\nBy category:')
  for (const [k, v] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)

  if (!APPLY) {
    console.log('\nDry run only — pass --apply to update these rows.')
    return
  }

  let updated = 0
  for (const r of rows!) {
    const { error: updErr } = await supabase
      .from('transactions')
      .update({
        status: 'confirmed',
        confirmed_by: r.recorded_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (updErr) {
      console.error(`Failed to update ${r.id}:`, updErr.message)
      continue
    }
    updated++
  }

  console.log(`\nUpdated ${updated}/${total} rows to status='confirmed'.`)
}

main()
