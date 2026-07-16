/**
 * One-time migration: import legacy "Sudah Ditangani" sessions from orders_medical_records.json
 * into patient_visits, linked to the correct package via package_id.
 *
 * After inserting visits for a package, sets legacy_used_sessions = 0 on that package
 * so the patient_packages_with_stats view doesn't double-count.
 *
 * Idempotent: skips packages that already have patient_visits linked.
 *
 * Run with:
 *   npx tsx data_migrations/sync-legacy-visits.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── env ────────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BRANCH_ID = 'cfe27e13-ba0b-440d-99f3-03e059efb877'  // Fisioterapi Gang Sehat Pontianak

// ── types ──────────────────────────────────────────────────────────────────────
interface MedicalRecord {
  KODE: string
  PASIEN: string
  SESSION_TANGGAL: string
  SESSION_JAM: string
  SESSION_FISIO: string
  SESSION_STATUS: string
  SESSION_KETERANGAN: string
}

// ── helpers ────────────────────────────────────────────────────────────────────
function parseIndonesianDate(dmy: string): string | null {
  // "DD-MM-YYYY" → "YYYY-MM-DD"
  const [d, m, y] = dmy.split('-')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function deriveShift(jam: string): 'PAGI' | 'SORE' {
  if (!jam || jam === '-') return 'PAGI'
  const [h] = jam.split(':').map(Number)
  return h < 12 ? 'PAGI' : 'SORE'
}

function matchTherapist(
  fisioName: string,
  profiles: { id: string; full_name: string }[],
): string | null {
  if (!fisioName || fisioName === '-') return null
  const upper = fisioName.trim().toUpperCase()

  for (const p of profiles) {
    const words = p.full_name.toUpperCase().split(/\s+/)
    // Exact word match
    if (words.some((w) => w === upper)) return p.id
  }
  for (const p of profiles) {
    const words = p.full_name.toUpperCase().split(/\s+/)
    // Prefix match (e.g., "AUL" matches "AULIA")
    if (words.some((w) => w.startsWith(upper) && upper.length >= 3)) return p.id
  }

  return null
}

// ── load source data ───────────────────────────────────────────────────────────
const MIGRATION_DIR = __dirname
const medicalRaw: MedicalRecord[] = JSON.parse(
  fs.readFileSync(path.join(MIGRATION_DIR, 'orders_medical_records.json'), 'utf8')
)

// Group "Sudah Ditangani" sessions by KODE
const sessionsByKode = new Map<string, MedicalRecord[]>()
for (const r of medicalRaw) {
  if (r.SESSION_STATUS !== 'Sudah Ditangani') continue
  const list = sessionsByKode.get(r.KODE) ?? []
  list.push(r)
  sessionsByKode.set(r.KODE, list)
}
console.log(`Loaded ${medicalRaw.length} records; ${sessionsByKode.size} KODEs have "Sudah Ditangani" sessions`)

// ── connect ────────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── main ───────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Fetch internal_profiles for therapist name → ID lookup
  const { data: profilesData, error: profErr } = await supabase
    .from('internal_profiles')
    .select('id, full_name')
  if (profErr) throw new Error(`profiles fetch failed: ${profErr.message}`)
  const profiles = profilesData ?? []
  console.log(`\nLoaded ${profiles.length} staff profiles for therapist matching`)

  // 2. Fetch packages with KODE in notes (paginated)
  console.log('\nFetching packages with KODE in notes...')
  const PAGE = 1000
  const allPackages: { id: string; patient_id: string; notes: string; legacy_used_sessions: number }[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('patient_packages')
      .select('id, patient_id, notes, legacy_used_sessions')
      .like('notes', 'kode:TRX/%')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`packages fetch failed: ${error.message}`)
    if (!data?.length) break
    allPackages.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  Found ${allPackages.length} packages with KODE in notes`)

  // 3. Process each package
  let inserted = 0
  let skipped = 0
  let noSessions = 0
  let failed = 0

  for (const pkg of allPackages) {
    const kode = pkg.notes.replace('kode:', '').trim()
    const sessions = sessionsByKode.get(kode)

    if (!sessions?.length) {
      noSessions++
      continue
    }

    // Idempotent guard: legacy sessions are tracked by legacy_used_sessions > 0.
    // Once imported, we set it to 0. So skip if already 0 (either imported or no legacy).
    if (pkg.legacy_used_sessions === 0) {
      skipped++
      continue
    }

    // Build visit rows
    const rows = sessions.map((s) => {
      const visitDate = parseIndonesianDate(s.SESSION_TANGGAL)
      const keterangan = s.SESSION_KETERANGAN?.trim()
      return {
        patient_id:          pkg.patient_id,
        package_id:          pkg.id,
        branch_id:           BRANCH_ID,
        visit_date:          visitDate,
        visit_time:          s.SESSION_JAM && s.SESSION_JAM !== '-' ? s.SESSION_JAM : null,
        shift:               deriveShift(s.SESSION_JAM),
        service_type:        'SESI TERAPI',
        kehadiran:           'HADIR',
        status:              'completed',
        attending_staff_id:  matchTherapist(s.SESSION_FISIO, profiles),
        notes:               keterangan && keterangan !== '-' ? keterangan : null,
      }
    })

    // Batch insert
    const { error: insertErr } = await supabase.from('patient_visits').insert(rows)
    if (insertErr) {
      console.error(`  FAIL ${kode}: ${insertErr.message}`)
      failed++
      continue
    }

    // Reset legacy_used_sessions to 0 (view now counts real visits)
    const { error: resetErr } = await supabase
      .from('patient_packages')
      .update({ legacy_used_sessions: 0 })
      .eq('id', pkg.id)
    if (resetErr) {
      console.error(`  WARN ${kode}: could not reset legacy_used_sessions: ${resetErr.message}`)
    }

    console.log(`  OK ${kode}: inserted ${rows.length} visits`)
    inserted += rows.length
  }

  console.log(`
Done.
  Packages processed: ${allPackages.length}
  Sessions inserted:  ${inserted}
  Packages skipped (already imported): ${skipped}
  Packages with no "Sudah Ditangani" sessions: ${noSessions}
  Failures: ${failed}
`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
