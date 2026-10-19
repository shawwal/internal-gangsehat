/**
 * Import Singkawang patients from FISIOTERAPI.xlsx (sheet "DATA PASIEN") → patients table.
 * Run: npx tsx scripts/import-patients-singkawang.mts [--dry-run]
 *
 * patients has no branch_id, so dedup runs against the whole table (Pontianak included):
 *   - skip if no_rm already exists (makes re-runs safe)
 *   - skip if phone_hash matches AND the name matches (equal / word-contained / ≤2 edits)
 *   - shared phone + different name = different person (family members) → insert
 * Inside the sheet, duplicate RMs and same-phone + same-name rows collapse to the latest row.
 */

import { normalizeBirthDate } from '../lib/dates'
import {
  DRY_RUN, createAdmin, decryptOrNull, encrypt, namesMatch, readRoster,
  type RosterPatient as Candidate,
} from './lib/singkawang.mjs'

type DbPatient = {
  no_rm: string | null
  phone_hash: string | null
  name_normalized: string | null
  encrypted_birth_date: string | null
}

async function main() {
  if (DRY_RUN) console.log('🧪 DRY RUN — no writes will be made\n')

  const supabase = createAdmin()

  console.log('📖 Reading DATA PASIEN from FISIOTERAPI.xlsx...')
  const parsed: Candidate[] = readRoster()
  console.log(`   ${parsed.length} patient rows`)

  // ── In-sheet dedup: latest row wins ──
  const sheetDropped: string[] = []
  parsed.sort((a, b) => b.ts - a.ts || b.rowNo - a.rowNo) // newest first
  const byRm = new Set<string>()
  const kept: Candidate[] = []
  for (const c of parsed) {
    if (byRm.has(c.no_rm)) {
      sheetDropped.push(`${c.name} (${c.no_rm}, row ${c.rowNo}) — duplicate RM in sheet`)
      continue
    }
    const twin = c.hash ? kept.find(k => k.hash === c.hash && namesMatch(k.name, c.name, k.birthDate, c.birthDate)) : undefined
    if (twin) {
      sheetDropped.push(`${c.name} (${c.no_rm}, row ${c.rowNo}) — same person as ${twin.name} (${twin.no_rm})`)
      continue
    }
    byRm.add(c.no_rm)
    kept.push(c)
  }
  kept.sort((a, b) => a.ts - b.ts || a.rowNo - b.rowNo) // insert in registration order
  console.log(`   ${kept.length} unique after in-sheet dedup (${sheetDropped.length} dropped)`)

  // ── Load existing identifiers ──
  console.log('\n🔍 Loading existing patients from DB...')
  const existingRms = new Set<string>()
  const byHash = new Map<string, DbPatient[]>()
  let dbTotal = 0
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('patients')
      .select('no_rm, phone_hash, name_normalized, encrypted_birth_date')
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as DbPatient[]) {
      dbTotal++
      if (r.no_rm) existingRms.add(r.no_rm.toUpperCase())
      if (r.phone_hash) {
        const list = byHash.get(r.phone_hash) ?? []
        list.push(r)
        byHash.set(r.phone_hash, list)
      }
    }
    if (!data || data.length < 1000) break
  }
  console.log(`   ${dbTotal} patients, ${existingRms.size} RM numbers, ${byHash.size} phone hashes`)

  // ── Insert ──
  console.log(`\n${DRY_RUN ? '🧪 Simulating' : '⬆️  Importing'} patients...\n`)
  let imported = 0
  let errors   = 0
  const skippedRm: string[] = []
  const skippedPhone: string[] = []
  const sharedPhone: string[] = []
  const errorList: string[] = []

  for (let i = 0; i < kept.length; i++) {
    const c = kept[i]
    const progress = () => process.stdout.write(
      `\r   [${i + 1}/${kept.length}] ✅ ${imported}  ↷ ${skippedRm.length + skippedPhone.length}  ❌ ${errors}`,
    )

    if (existingRms.has(c.no_rm)) {
      skippedRm.push(`${c.name} (${c.no_rm})`)
      progress()
      continue
    }
    const sameHash = c.hash ? byHash.get(c.hash) ?? [] : []
    const match = sameHash.find(r => namesMatch(r.name_normalized ?? '', c.name, normalizeBirthDate(decryptOrNull(r.encrypted_birth_date)), c.birthDate))
    if (match) {
      skippedPhone.push(`${c.name} (${c.no_rm}) = DB "${match.name_normalized}" (${match.no_rm ?? 'no RM'})`)
      progress()
      continue
    }
    if (sameHash.length) {
      sharedPhone.push(`${c.name} (${c.no_rm}) shares phone with DB: ${sameHash.map(r => `"${r.name_normalized}"`).join(', ')}`)
    }

    const row: DbPatient = {
      no_rm:                c.no_rm,
      // phone_hash is UNIQUE — like phoneHashIfFree() in app/actions/patients.ts, a family
      // member on an already-used phone keeps the encrypted phone but no hash
      phone_hash:           sameHash.length ? null : c.hash,
      name_normalized:      c.name.toLowerCase(),
      encrypted_birth_date: c.birthDate ? encrypt(c.birthDate) : null,
    }

    if (!DRY_RUN) {
      const { error } = await supabase.from('patients').insert({
        encrypted_name:       encrypt(c.name),
        encrypted_phone:      encrypt(c.phone || '-'), // NOT NULL
        encrypted_address:    c.address ? encrypt(c.address) : null,
        encrypted_birth_date: row.encrypted_birth_date,
        gender:               c.gender,
        no_rm:                c.no_rm,
        pekerjaan:            c.pekerjaan,
        agama:                c.agama,
        hobi:                 c.hobi,
        keluhan:              c.keluhan,
        last_booking_age:     c.age,
        phone_hash:           row.phone_hash,
        name_normalized:      row.name_normalized,
        is_active:            true,
      })
      if (error) {
        errors++
        errorList.push(`${c.name} (${c.no_rm}): ${error.message}`)
        progress()
        continue
      }
    }

    imported++
    existingRms.add(c.no_rm)
    if (c.hash) byHash.set(c.hash, [...sameHash, row])
    progress()
  }

  console.log('\n\n' + '─'.repeat(55))
  console.log(DRY_RUN ? '🧪 Dry run complete!' : '🎉 Import complete!')
  console.log(`   ✅ ${DRY_RUN ? 'Would import' : 'Imported'}       : ${imported}`)
  console.log(`   ↷  Dropped in sheet    : ${sheetDropped.length}`)
  console.log(`   ↷  Skipped (RM in DB)  : ${skippedRm.length}`)
  console.log(`   ↷  Skipped (phone+name): ${skippedPhone.length}`)
  console.log(`   ❌ Errors              : ${errors}`)

  const dump = (title: string, list: string[]) => {
    if (!list.length) return
    console.log(`\n${title} (${list.length}):`)
    for (const s of list) console.log(`   - ${s}`)
  }
  dump('📋 Dropped as in-sheet duplicates', sheetDropped)
  dump('📋 Skipped — RM already in DB', skippedRm)
  dump('📋 Skipped — same phone + name already in DB', skippedPhone)
  dump('👪 Inserted despite shared phone (different name)', sharedPhone)
  dump('⚠️  Errors', errorList)
}

main().catch((e) => { console.error(e); process.exit(1) })
