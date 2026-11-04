/**
 * Import Nafaya Centre children from the Google Form export
 * (reference/Database Pasien Layanan Anak Nafaya Centre (1).xlsx, sheet "Form Responses 1")
 * → patients + griya_students (branch Nafaya Centre, source 'import').
 * Run: npx tsx scripts/import-nafaya-students.mts [--dry-run]
 *
 * No. RM: Nafaya's own scheme — initial + birth YY + registration YY + MM + 4-digit
 * sequence per registration month (A2126010001). The sheet stopped numbering after
 * Feb 2026 ("…0000" placeholders, many repeated); those rows get the next free
 * sequence of their month, in registration order. The list is printed for the clinic.
 *
 * Dedup:
 *   - in the sheet: same name + birth date = one child (first registration kept)
 *   - against the DB: same RM, or same phone + matching name → existing patient is
 *     only enrolled (if not on any Griya roster yet), never re-inserted
 *   - shared phone + different name (siblings, twins) → separate child, no phone_hash
 *     (UNIQUE), like phoneHashIfFree() in app/actions/patients.ts
 * Re-runs are safe: imported RMs are found again and skipped.
 */

import { join } from 'path'
import { readFileSync } from 'fs'
import { normalizeSumber } from '../lib/griyaSumber'
import {
  DRY_RUN, XLSX, __dirname, createAdmin, decryptOrNull, encrypt, fetchAll, hashPhone,
  namesMatch, normalizeAgama, normalizeGender, normalizePhone, str,
} from './lib/singkawang.mjs'

const XLSX_FILE = join(__dirname, '../../reference/Database Pasien Layanan Anak Nafaya Centre (1).xlsx')
const SHEET = 'Form Responses 1'

type Child = {
  rowNo: number
  ts: number               // Excel serial — registration order
  regYY: number
  regMM: number
  name: string
  rm: string | null        // real RM from the sheet; null = placeholder
  birthDate: string | null
  gender: 'male' | 'female' | 'other'
  phone: string
  hash: string | null
  address: string | null
  kelurahan: string | null
  kecamatan: string | null
  kabupaten: string | null
  provinsi: string | null
  agama: string | null
  keluhan: string | null
  namaAyah: string | null
  namaIbu: string | null
  sumber: string | null
  notes: string | null
}

type DbPatient = { id: string; no_rm: string | null; phone_hash: string | null; name_normalized: string | null; encrypted_birth_date: string | null }

const clean = (v: unknown) => str(v).replace(/\s+/g, ' ')
const opt = (v: unknown) => { const t = clean(v); return t && t !== '-' ? t : null }
const upper = (v: unknown) => opt(v)?.toUpperCase() ?? null
const pad = (n: number, w: number) => String(n).padStart(w, '0')

function serial(v: unknown): { y: number; m: number; d: number } | null {
  if (typeof v !== 'number') return null
  const p = XLSX.SSF.parse_date_code(v)
  return p ? { y: p.y, m: p.m, d: p.d } : null
}

function readChildren(): Child[] {
  const wb = XLSX.read(readFileSync(XLSX_FILE))
  const ws = wb.Sheets[SHEET]
  if (!ws) throw new Error(`Sheet "${SHEET}" not found`)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
  const out: Child[] = []
  rows.slice(1).forEach((r, i) => {
    const name = clean(r[3])
    if (!name) return
    const reg = serial(r[0])
    const dob = serial(r[6])
    const rawRm = clean(r[4]).toUpperCase()
    const phone = normalizePhone(r[9])
    const extra = [
      opt(r[16]) && `Pendamping: ${opt(r[16])}`,
      opt(r[17]) && `Pendidikan: ${opt(r[17])}`,
      opt(r[18]) && `Sekolah: ${opt(r[18])}`,
    ].filter(Boolean).join(' · ')
    out.push({
      rowNo: i + 2,
      ts: typeof r[0] === 'number' ? r[0] : 0,
      regYY: reg ? reg.y % 100 : 26,
      regMM: reg ? reg.m : 1,
      name,
      rm: /^[A-Z]\d{10}$/.test(rawRm) && !rawRm.endsWith('0000') ? rawRm : null,
      birthDate: dob ? `${dob.y}-${pad(dob.m, 2)}-${pad(dob.d, 2)}` : null,
      gender: normalizeGender(str(r[5])),
      phone,
      hash: phone ? hashPhone(phone) : null,
      address: opt(r[10]),
      kelurahan: upper(r[11]),
      kecamatan: upper(r[12]),
      kabupaten: upper(r[13]),
      provinsi: upper(r[14]),
      agama: normalizeAgama(str(r[15])),
      keluhan: opt(r[19]),
      namaAyah: opt(r[20]),
      namaIbu: opt(r[21]),
      sumber: normalizeSumber(opt(r[23])),
      notes: extra || null,
    })
  })
  return out
}

async function main() {
  if (DRY_RUN) console.log('🧪 DRY RUN — no writes will be made\n')
  const supabase = createAdmin()

  const { data: branch, error: bErr } = await supabase
    .from('branches').select('id, name, is_active').ilike('name', '%Nafaya%').maybeSingle()
  if (bErr || !branch) throw new Error(`Nafaya branch not found: ${bErr?.message ?? 'no row'}`)
  console.log(`🏠 Branch: ${branch.name} (${branch.id})${branch.is_active ? '' : ' ⚠️  INACTIVE'}`)

  const all = readChildren()
  console.log(`📖 ${all.length} rows in "${SHEET}"`)

  // ── In-sheet dedup: same name + birth date → first registration ──
  all.sort((a, b) => a.ts - b.ts || a.rowNo - b.rowNo)
  const kids: Child[] = []
  const dropped: string[] = []
  for (const c of all) {
    const twin = kids.find((k) => k.birthDate === c.birthDate && namesMatch(k.name, c.name, k.birthDate, c.birthDate))
    if (twin) { dropped.push(`row ${c.rowNo} ${c.name} — same child as row ${twin.rowNo}`); continue }
    kids.push(c)
  }
  console.log(`   ${kids.length} children after in-sheet dedup (${dropped.length} repeat registrations)`)

  // ── Existing data ──
  const db = await fetchAll<DbPatient>((f, t) => supabase.from('patients')
    .select('id, no_rm, phone_hash, name_normalized, encrypted_birth_date').order('id').range(f, t))
  const enrolled = new Map((await fetchAll<{ patient_id: string; branch_id: string }>((f, t) =>
    supabase.from('griya_students').select('patient_id, branch_id').order('patient_id').range(f, t)))
    .map((s) => [s.patient_id, s.branch_id]))
  const byRm = new Map(db.filter((p) => p.no_rm).map((p) => [p.no_rm!.toUpperCase(), p]))
  const byHash = new Map<string, DbPatient[]>()
  for (const p of db) if (p.phone_hash) byHash.set(p.phone_hash, [...(byHash.get(p.phone_hash) ?? []), p])
  const nafayaRoster = db.filter((p) => enrolled.get(p.id) === branch.id)
  console.log(`🔍 DB: ${db.length} patients, ${enrolled.size} on a Griya roster`)

  // ── RM assignment: next free sequence in the registration month ──
  const usedSeq = new Map<string, number>() // 'YYMM' → highest sequence
  const monthKey = (yy: number, mm: number) => `${pad(yy, 2)}${pad(mm, 2)}`
  const noteSeq = (rm: string) => {
    const key = rm.slice(3, 7), seq = Number(rm.slice(7))
    usedSeq.set(key, Math.max(usedSeq.get(key) ?? 0, seq))
  }
  // Seed from the sheet's real RMs only — clinic RMs share the length but not the
  // layout. A generated RM that exists anywhere in the DB is skipped below.
  for (const k of kids) if (k.rm) noteSeq(k.rm)

  const generated: string[] = []
  let inserted = 0, enrolledOnly = 0, alreadyListed = 0, errors = 0
  const matched: string[] = [], shared: string[] = [], errorList: string[] = []

  for (const c of kids) {
    // Existing patient? (real RM, else phone + name)
    let existing = c.rm ? byRm.get(c.rm) : undefined
    const sameHash = c.hash ? byHash.get(c.hash) ?? [] : []
    if (!existing) {
      existing = sameHash.find((p) => namesMatch(p.name_normalized ?? '', c.name,
        decryptOrNull(p.encrypted_birth_date), c.birthDate))
    }
    // Re-run: a sibling on a shared phone has no phone_hash — find them on the Nafaya
    // roster by name + birth date instead.
    if (!existing && c.birthDate) {
      existing = nafayaRoster.find((p) => decryptOrNull(p.encrypted_birth_date) === c.birthDate
        && namesMatch(p.name_normalized ?? '', c.name, c.birthDate, c.birthDate))
    }

    if (existing) {
      const on = enrolled.get(existing.id)
      if (on) { alreadyListed++; matched.push(`${c.name} = existing ${existing.no_rm ?? existing.id} (already on ${on === branch.id ? 'Nafaya' : 'another Griya'} roster)`); continue }
      matched.push(`${c.name} = existing ${existing.no_rm ?? existing.id} → enrolled`)
      if (!DRY_RUN) {
        const { error } = await supabase.from('griya_students').insert({ patient_id: existing.id, branch_id: branch.id, source: 'import' })
        if (error) { errors++; errorList.push(`${c.name}: ${error.message}`); continue }
      }
      enrolled.set(existing.id, branch.id)
      enrolledOnly++
      continue
    }

    let rm = c.rm
    if (!rm || byRm.has(rm)) {
      const key = monthKey(c.regYY, c.regMM)
      const birthYY = c.birthDate ? Number(c.birthDate.slice(2, 4)) : c.regYY
      const initial = (c.name.match(/[A-Za-z]/)?.[0] ?? 'X').toUpperCase()
      do {
        const seq = (usedSeq.get(key) ?? 0) + 1
        usedSeq.set(key, seq)
        rm = `${initial}${pad(birthYY, 2)}${key}${pad(seq, 4)}`
      } while (byRm.has(rm))
      generated.push(`${rm}  ${c.name}  (row ${c.rowNo})`)
    }
    if (sameHash.length) shared.push(`${c.name} (${rm}) shares phone with: ${sameHash.map((p) => p.name_normalized).join(', ')}`)

    const row: DbPatient = { id: '', no_rm: rm, phone_hash: sameHash.length ? null : c.hash, name_normalized: c.name.toLowerCase(), encrypted_birth_date: c.birthDate ? encrypt(c.birthDate) : null }
    if (!DRY_RUN) {
      const { data, error } = await supabase.from('patients').insert({
        encrypted_name:       encrypt(c.name),
        encrypted_phone:      encrypt(c.phone || '-'), // NOT NULL
        encrypted_address:    c.address ? encrypt(c.address) : null,
        encrypted_birth_date: row.encrypted_birth_date,
        gender:               c.gender,
        phone_hash:           row.phone_hash,
        name_normalized:      row.name_normalized,
        no_rm:                rm,
        agama:                c.agama,
        kelurahan:            c.kelurahan,
        kecamatan:            c.kecamatan,
        kabupaten_kota:       c.kabupaten,
        provinsi:             c.provinsi,
        keluhan:              c.keluhan,
        medical_notes:        c.notes,
        nama_ayah:            c.namaAyah,
        nama_ibu:             c.namaIbu,
        sumber:               c.sumber,
        is_active:            true,
      }).select('id').single()
      if (error || !data) { errors++; errorList.push(`${c.name} (${rm}): ${error?.message}`); continue }
      row.id = data.id
      const { error: eErr } = await supabase.from('griya_students').insert({ patient_id: data.id, branch_id: branch.id, source: 'import' })
      if (eErr) {
        // Don't leave a child that isn't on the roster — undo, like patientRegistrations approval.
        await supabase.from('patients').delete().eq('id', data.id)
        errors++; errorList.push(`${c.name} (${rm}) enrol: ${eErr.message}`); continue
      }
    }
    byRm.set(rm!, row)
    if (row.phone_hash) byHash.set(row.phone_hash, [...sameHash, row])
    else if (c.hash) byHash.set(c.hash, [...sameHash, row])
    inserted++
  }

  const dump = (title: string, list: string[]) => {
    if (!list.length) return
    console.log(`\n${title} (${list.length}):`)
    for (const s of list) console.log(`   - ${s}`)
  }
  console.log('\n' + '─'.repeat(55))
  console.log(DRY_RUN ? '🧪 Dry run complete!' : '🎉 Import complete!')
  console.log(`   ✅ New children        : ${inserted}`)
  console.log(`   ➕ Existing → enrolled : ${enrolledOnly}`)
  console.log(`   ↷  Already on a roster : ${alreadyListed}`)
  console.log(`   ↷  Repeat registrations: ${dropped.length}`)
  console.log(`   ❌ Errors              : ${errors}`)
  dump('📋 Repeat registrations in the sheet', dropped)
  dump('🔗 Matched existing patients', matched)
  dump('🆕 RM numbers assigned (sheet had a placeholder)', generated)
  dump('👪 Shared phone (kept as separate children)', shared)
  dump('⚠️  Errors', errorList)
}

main().catch((e) => { console.error(e); process.exit(1) })
