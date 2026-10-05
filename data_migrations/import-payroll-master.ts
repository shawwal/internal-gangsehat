/**
 * One-time import of the legacy payroll "ID" sheet (employee master + pay
 * structure) into employee_payroll_profiles + employee_compensation.
 *
 * Source: lib/payroll/__fixtures__/penggajian-sep-2026.json — extracted from
 * reference/1.1 - Request Sistem Penggajian (Example).xlsx, including each
 * person's incentive scheme (targets 60/110/20/39, masseur rules, visit rates)
 * that the engine tests verify against the GAJI sheet.
 *
 * Staff are matched to internal_profiles by nickname (the sheet's ID column)
 * or full name, case-insensitive, within the chosen branch.
 *
 * Defaults to DRY RUN. Pass --apply to write.
 *   npx tsx data_migrations/import-payroll-master.ts --branch "Pontianak"
 *   npx tsx data_migrations/import-payroll-master.ts --branch "Pontianak" --effective 2026-08-27 --apply
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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const APPLY = args.includes('--apply')
const BRANCH = arg('--branch')
const EFFECTIVE = arg('--effective') ?? '2026-08-27'

interface FixtureEmployee {
  employee_no: string
  full_name: string
  alias: string
  jabatan: string
  compensation: Record<string, unknown>
}

async function main() {
  if (!BRANCH) {
    console.error('Pass --branch "<branch name>" (case-insensitive substring match).')
    process.exit(1)
  }
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/payroll/__fixtures__/penggajian-sep-2026.json'), 'utf8')) as {
    employees: FixtureEmployee[]
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: branches } = await db.from('branches').select('id, name')
  const branch = (branches ?? []).find((b) => b.name.toLowerCase().includes(BRANCH.toLowerCase()))
  if (!branch) {
    console.error(`Branch "${BRANCH}" not found. Available: ${(branches ?? []).map((b) => b.name).join(', ')}`)
    process.exit(1)
  }
  console.log(`Branch: ${branch.name} · effective_from ${EFFECTIVE} · ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const { data: staff } = await db
    .from('internal_profiles')
    .select('id, full_name, nickname, is_active')
    .eq('branch_id', branch.id)
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

  let matched = 0
  const unmatched: string[] = []
  for (const e of fixture.employees) {
    // Fuzzy fallback (first name) only when it is unambiguous — review the dry run.
    const first = norm(e.full_name).split(' ')[0]
    const byFirst = first.length > 3 ? (staff ?? []).filter((s) => norm(s.full_name).split(' ')[0] === first) : []
    const hit = (staff ?? []).find((s) => norm(s.nickname) === norm(e.alias))
      ?? (staff ?? []).find((s) => norm(s.full_name) === norm(e.full_name))
      ?? (byFirst.length === 1 ? byFirst[0] : undefined)
    if (!hit) {
      unmatched.push(`${e.employee_no} ${e.full_name} (${e.alias})`)
      continue
    }
    matched++
    console.log(`✓ ${e.employee_no.padEnd(9)} ${e.full_name.padEnd(28)} → ${hit.full_name}${hit.is_active ? '' : ' (inactive)'}`)
    if (!APPLY) continue

    const { error: pErr } = await db.from('employee_payroll_profiles').upsert({
      staff_id: hit.id, employee_no: e.employee_no, jabatan: e.jabatan, include_in_payroll: true,
    }, { onConflict: 'staff_id' })
    if (pErr) { console.error(`  profile error: ${pErr.message}`); continue }

    const c = e.compensation
    const { error: cErr } = await db.from('employee_compensation').upsert({
      staff_id: hit.id,
      effective_from: EFFECTIVE,
      ...c,
      activity_rates: Object.fromEntries(Object.entries((c.activity_rates as Record<string, number>) ?? {}).filter(([, v]) => v > 0)),
      bonus_tiers: ((c.bonus_tiers as { amount: number }[]) ?? []).filter((t) => t.amount > 0),
      notes: 'Impor dari sheet ID (Penggajian September 2026)',
    }, { onConflict: 'staff_id,effective_from', ignoreDuplicates: true })
    if (cErr) console.error(`  compensation error: ${cErr.message}`)
  }

  console.log(`\nMatched ${matched}/${fixture.employees.length}.`)
  if (unmatched.length) {
    console.log('Not matched (create the account or set its nickname, then re-run):')
    unmatched.forEach((u) => console.log(`  - ${u}`))
  }
  if (!APPLY) console.log('\nDry run — nothing written. Re-run with --apply.')
}

main().catch((err) => { console.error(err); process.exit(1) })
