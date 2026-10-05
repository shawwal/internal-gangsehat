/**
 * One-time import of the legacy PFOTM "Rekap Data" (Jan–Sep 2026) as locked
 * PFOTM periods, so the leaderboard history, KPIs and "Daftar Pemenang"
 * continue from the spreadsheet.
 *
 * Source: lib/pfotm/__fixtures__/pfotm-2026.json — extracted from
 * reference/2.2 - Request Sistem Leaderboard Fisioterapis (Example).xlsx.
 * Each month is frozen with the sheet's own weights (incl. Alfa = +2) as its
 * rules_snapshot, so imported totals match "Rekap Poin" exactly. New months use
 * the configurable pfotm_point_rules (Alfa = −2).
 *
 * Defaults to DRY RUN. Pass --apply to write. Existing periods are skipped.
 *   npx tsx data_migrations/import-pfotm-history.ts --branch "Pontianak"
 *   npx tsx data_migrations/import-pfotm-history.ts --branch "Pontianak" --apply
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { rankBoard, type PointRule } from '../lib/pfotm/engine'
import { periodRange } from '../lib/payroll/period'

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
const APPLY = args.includes('--apply')
const bi = args.indexOf('--branch')
const BRANCH = bi >= 0 ? args[bi + 1] : undefined

const LABELS: Record<string, string> = {
  hadir: 'Hadir', terlambat: 'Terlambat', alfa: 'Alfa', kunjungan: 'Jumlah Kunjungan', paket_1: 'Paket 1', paket_2: 'Paket 2',
  paket_3: 'Paket 3', ta_sesi_visit: 'TA/Sesi Visit', paket_visit: 'Paket Visit', rujukan_sm: 'Rujukan SM', kegiatan_external: 'Kegiatan External',
}

async function main() {
  if (!BRANCH) {
    console.error('Pass --branch "<branch name>".')
    process.exit(1)
  }
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/pfotm/__fixtures__/pfotm-2026.json'), 'utf8')) as {
    year: number
    sheet_weights: Record<string, number>
    months: { month: number; working_days: number; entries: { name: string; metrics: Record<string, number>; expected_total: number }[] }[]
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: branches } = await db.from('branches').select('id, name')
  const branch = (branches ?? []).find((b) => b.name.toLowerCase().includes(BRANCH.toLowerCase()))
  if (!branch) {
    console.error(`Branch "${BRANCH}" not found.`)
    process.exit(1)
  }
  const { data: staff } = await db.from('internal_profiles').select('id, full_name, nickname').eq('branch_id', branch.id)
  const byName = (name: string) => {
    const n = name.trim().toLowerCase()
    const byFirst = (staff ?? []).filter((s) => s.full_name.trim().toLowerCase().split(' ')[0] === n)
    return (staff ?? []).find((s) => (s.nickname ?? '').trim().toLowerCase() === n)
      ?? (byFirst.length === 1 ? byFirst[0] : null)
  }

  const rules: PointRule[] = Object.entries(fixture.sheet_weights).map(([metric_key, weight]) => ({
    metric_key, metric_label: LABELS[metric_key] ?? metric_key, weight, is_penalty: weight < 0,
  }))

  console.log(`Branch: ${branch.name} · ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)
  for (const month of fixture.months) {
    const { data: existing } = await db.from('pfotm_periods').select('id')
      .eq('branch_id', branch.id).eq('period_year', fixture.year).eq('period_month', month.month).maybeSingle()
    if (existing) { console.log(`- ${fixture.year}-${month.month}: already exists, skipped`); continue }

    const board = rankBoard(month.entries.map((e) => ({ key: e.name, name: e.name, metrics: e.metrics })), rules, month.working_days)
    const mismatches = board.filter((r) => r.total !== month.entries.find((e) => e.name === r.name)!.expected_total)
    const unmatched = month.entries.filter((e) => !byName(e.name)).map((e) => e.name)
    console.log(`- ${fixture.year}-${String(month.month).padStart(2, '0')}: ${board.length} entries, champion ${board[0]?.name} (${board[0]?.total})` +
      `${mismatches.length ? ` · ${mismatches.length} TOTAL MISMATCH` : ''}${unmatched.length ? ` · unmatched staff: ${unmatched.join(', ')}` : ''}`)
    if (!APPLY) continue

    const { start, end } = periodRange(fixture.year, month.month, 27)
    const { data: period, error } = await db.from('pfotm_periods').insert({
      branch_id: branch.id, period_year: fixture.year, period_month: month.month, start_date: start, end_date: end,
      working_days: month.working_days, working_days_override: true, is_locked: true, locked_at: new Date().toISOString(),
      rules_snapshot: rules,
    }).select('id').single()
    if (error || !period) { console.error(`  period error: ${error?.message}`); continue }

    const { error: eErr } = await db.from('pfotm_entries').insert(board.map((r) => ({
      period_id: period.id,
      staff_id: byName(r.name)?.id ?? null,
      display_name: r.name,
      auto_metrics: {},
      override_metrics: r.metrics,   // raw sheet values, so an unlock/re-lock recomputes identically
      metrics: r.metrics,
      points_breakdown: r.breakdown,
      total_points: r.total,
      rank: r.rank,
      kpis: r.kpis,
    })))
    if (eErr) console.error(`  entries error: ${eErr.message}`)
  }
  if (!APPLY) console.log('\nDry run — nothing written. Re-run with --apply.')
}

main().catch((err) => { console.error(err); process.exit(1) })
