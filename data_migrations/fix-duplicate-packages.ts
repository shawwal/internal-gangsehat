/**
 * Fix two classes of package data issues:
 *
 * 1. DUPLICATES: patients who have two packages of the same name where one has
 *    a kode: note (authoritative) and one does not (fuzzy match artifact).
 *    → Delete the no-kode duplicate; visits are re-imported by sync-all-sessions.
 *
 * 2. WRONG total_sessions: fixed packages (PAKET 1/2/SILVER/GOLD/PLATINUM) where
 *    total_sessions was inflated by old-system's "TOTAL PERTEMUAN" double-counting
 *    rescheduled slots.
 *    → Clamp to the canonical fixed size.
 *
 * Run with: npx tsx data_migrations/fix-duplicate-packages.ts
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

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Canonical fixed sizes (in sessions)
const FIXED_TOTAL: Record<string, number> = {
  'PAKET 1':          5,
  'PAKET 2':          10,
  'PAKET SILVER':     5,
  'PAKET GOLD':       10,
  'PAKET PLATINUM':   20,
}

async function main() {
  // Fetch all packages
  const PAGE = 1000
  const allPkgs: {
    id: string; patient_id: string; package_name: string
    notes: string | null; total_sessions: number; status: string; created_at: string
  }[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('patient_packages')
      .select('id, patient_id, package_name, notes, total_sessions, status, created_at')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPkgs.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`Loaded ${allPkgs.length} packages`)

  // ── Fix 1: duplicates ───────────────────────────────────────────────────────
  // Group by patient_id + package_name
  const grouped = new Map<string, typeof allPkgs>()
  for (const p of allPkgs) {
    const key = `${p.patient_id}::${p.package_name}`
    const list = grouped.get(key) ?? []
    list.push(p)
    grouped.set(key, list)
  }

  const toDelete: string[] = []

  for (const [, pkgs] of grouped) {
    if (pkgs.length < 2) continue

    const withKode = pkgs.filter(p => p.notes?.startsWith('kode:'))
    const withoutKode = pkgs.filter(p => !p.notes?.startsWith('kode:'))

    if (withKode.length > 0 && withoutKode.length > 0) {
      // Keep all with-kode packages; delete the no-kode ones
      for (const dup of withoutKode) {
        toDelete.push(dup.id)
        const kodeList = withKode.map(p => p.notes?.replace('kode:', '')).join(', ')
        console.log(`  DUP ${dup.patient_id} / ${dup.package_name}: delete fuzzy pkg ${dup.id} (kept kode: ${kodeList})`)
      }
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicate packages found.')
  } else {
    console.log(`\nDeleting ${toDelete.length} duplicate packages...`)
    // Delete their visits first (FK constraint)
    const { error: delVisitErr } = await supabase.from('patient_visits')
      .delete().in('package_id', toDelete)
    if (delVisitErr) throw new Error(`Delete visits failed: ${delVisitErr.message}`)

    const { error: delPkgErr } = await supabase.from('patient_packages')
      .delete().in('id', toDelete)
    if (delPkgErr) throw new Error(`Delete packages failed: ${delPkgErr.message}`)
    console.log(`  Deleted ${toDelete.length} duplicate packages.`)
  }

  // ── Fix 2: wrong total_sessions ─────────────────────────────────────────────
  let fixedCount = 0
  for (const [name, maxSessions] of Object.entries(FIXED_TOTAL)) {
    // Find packages of this type where total_sessions exceeds the fixed maximum
    const wrong = allPkgs.filter(
      p => p.package_name === name && p.total_sessions > maxSessions && !toDelete.includes(p.id)
    )
    if (wrong.length === 0) continue

    for (const pkg of wrong) {
      console.log(`  FIX total_sessions: ${pkg.id} / ${pkg.notes ?? 'no-kode'} / ${name}: ${pkg.total_sessions} → ${maxSessions}`)
      const { error } = await supabase.from('patient_packages')
        .update({ total_sessions: maxSessions }).eq('id', pkg.id)
      if (error) console.error(`  FAIL: ${error.message}`)
      else fixedCount++
    }
  }

  if (fixedCount === 0) console.log('No wrong total_sessions found.')

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done.
  Duplicate packages deleted: ${toDelete.length}
  total_sessions corrected:   ${fixedCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
