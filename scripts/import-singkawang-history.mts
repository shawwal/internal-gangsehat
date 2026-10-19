/**
 * Import Singkawang packages (sheet "DATA PAKET") and visit history (sheet "CATATAN PELAYANAN")
 * from FISIOTERAPI.xlsx → patient_packages + patient_visits on the Singkawang branch.
 * Run after import-patients-singkawang.mts:  npx tsx scripts/import-singkawang-history.mts [--dry-run]
 *
 * - RM → patient: exact no_rm, else the DATA PASIEN row's merged/existing twin, else a unique name match.
 * - Packages are legacy (order_id NULL → exempt from the payment gate, see supabase/079-…).
 *   Paket visits whose date is one of the package's T dates get package_id; the rest of the
 *   T count goes into legacy_used_sessions, so used_sessions == the sheet's T count.
 * - A patient who already got an in-app package on/after the sheet package's date (admin
 *   created it manually) gets the sheet package as completed — no double sessions.
 * - Therapist = Singkawang profile whose first name equals TERAPIS; otherwise "Terapis: X"
 *   in notes, and later runs backfill attending_staff_id once that account exists.
 * - Re-runnable: existing packages (patient, purchased_at, package_name, T dates) and visits
 *   (patient, date, time, service) are skipped.
 */

import { normalizeBirthDate } from '../lib/dates'
import { dividersFromSlots, shiftForHour } from '../lib/shifts'
import {
  DRY_RUN, SINGKAWANG_BRANCH_ID as BRANCH, createAdmin, decryptOrNull, nameKey,
  namesMatch, normalizeName, readRoster, readSheet, serialToDate, str,
} from './lib/singkawang.mjs'

const IMPORT_NOTE = 'Import FISIOTERAPI.xlsx'
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

const REGIO = new Set([
  'HEAD', 'NECK', 'SHOULDER', 'UPPER ARM', 'ELBOW', 'LOWER ARM', 'WRIST', 'HAND', 'SPINE', 'CHEST',
  'UPPER BACK', 'LOWER BACK', 'ABDOMINAL', 'HIP/PELVIC', 'THIGH', 'KNEE', 'CALF', 'ANKLE', 'FOOT',
  'CNS', 'PNS', 'SYSTEMIC', 'CARDIOVASCULAR', 'PULMONAL', 'PERFORMANCE',
])

const PACKAGE_TYPES: Record<string, {
  package_name: string; jenis_paket: 'P1' | 'P2' | null; total_sessions: number; category: string
}> = {
  P1: { package_name: 'PAKET 1',       jenis_paket: 'P1', total_sessions: 5,  category: 'PAKET KLINIK' },
  P2: { package_name: 'PAKET 2',       jenis_paket: 'P2', total_sessions: 10, category: 'PAKET KLINIK' },
  P3: { package_name: 'PAKET 3',       jenis_paket: null, total_sessions: 10, category: 'PAKET KLINIK' },
  PV: { package_name: 'PAKET VISIT',   jenis_paket: null, total_sessions: 10, category: 'PAKET VISIT' },
  PM: { package_name: 'PAKET MASSAGE', jenis_paket: null, total_sessions: 5,  category: 'PAKET SPORT MASSAGE' },
}

const SERVICE_TYPES: Record<string, string> = {
  'TERAPI AWAL':     'TERAPI AWAL',
  'SESI TERAPI':     'SESI TERAPI',
  'PAKET TERAPI':    'PAKET TERAPI',
  'TA HOME CARE':    'TA VISIT',
  'SESI HOME CARE':  'SESI VISIT',
  'PAKET HOME CARE': 'PAKET VISIT',
}

// Which package category a paket visit draws from
const VISIT_PACKAGE_CATEGORY: Record<string, string> = {
  'PAKET TERAPI': 'PAKET KLINIK',
  'PAKET VISIT':  'PAKET VISIT',
}

type DbPatient = {
  id: string
  no_rm: string | null
  phone_hash: string | null
  name_normalized: string | null
  encrypted_birth_date: string | null
}

type PackageRow = {
  rowNo: number
  key: string
  patientId: string
  label: string
  existingId: string | null
  tempId: string
  insert: Record<string, unknown>
  tDates: string[]
  freeTDates: Set<string>
  linked: number
}

type VisitRow = {
  rowNo: number
  label: string
  patientId: string
  packageTempId: string | null
  insert: Record<string, unknown>
}

function toTime(v: unknown): string | null {
  if (typeof v === 'number') {
    const mins = Math.round((v % 1) * 24 * 60)
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
  const m = str(v).match(/^(\d{1,2})[.:](\d{2})/)
  if (!m || +m[1] > 23) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function anyDate(v: unknown): string | null {
  if (typeof v === 'number') return serialToDate(v)
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA')
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  if (DRY_RUN) console.log('🧪 DRY RUN — no writes will be made\n')
  const supabase = createAdmin()

  // ── Patients: build RM / name → patient id ────────────────────────────────
  console.log('🔍 Loading patients...')
  const dbPatients = await fetchAll<DbPatient>((f, t) => supabase.from('patients')
    .select('id, no_rm, phone_hash, name_normalized, encrypted_birth_date').order('id').range(f, t))
  const byRm = new Map<string, string>()
  const byHash = new Map<string, DbPatient[]>()
  for (const p of dbPatients) {
    if (p.no_rm) byRm.set(p.no_rm.toUpperCase(), p.id)
    if (p.phone_hash) byHash.set(p.phone_hash, [...(byHash.get(p.phone_hash) ?? []), p])
  }

  const roster = readRoster()
  const rosterByRm = new Map(roster.map(r => [r.no_rm, r]))
  const rosterIdCache = new Map<string, string | null>()

  // A roster RM that isn't in the DB was either merged into a twin row or matched an existing patient.
  function rosterId(rm: string): string | null {
    if (rosterIdCache.has(rm)) return rosterIdCache.get(rm)!
    const r = rosterByRm.get(rm)
    let id: string | null = byRm.get(rm) ?? null
    if (!id && r?.hash) {
      const db = (byHash.get(r.hash) ?? []).find(p =>
        namesMatch(p.name_normalized ?? '', r.name, normalizeBirthDate(decryptOrNull(p.encrypted_birth_date)), r.birthDate))
      id = db?.id ?? null
      if (!id) {
        const twin = roster.find(o => o !== r && o.hash === r.hash && byRm.has(o.no_rm)
          && namesMatch(o.name, r.name, o.birthDate, r.birthDate))
        id = twin ? byRm.get(twin.no_rm)! : null
      }
    }
    rosterIdCache.set(rm, id)
    return id
  }

  const viaName: string[] = []
  function resolvePatient(rmRaw: unknown, nameRaw: unknown): string | null {
    const rm = str(rmRaw).toUpperCase()
    const name = normalizeName(str(nameRaw))
    const direct = rm ? byRm.get(rm) ?? (rosterByRm.has(rm) ? rosterId(rm) : null) : null
    if (direct) return direct
    if (!name) return null
    // Unique name in the Singkawang roster — exact first, then fuzzy
    for (const exact of [true, false]) {
      const ids = new Set(roster
        .filter(r => exact ? nameKey(r.name) === nameKey(name) : namesMatch(r.name, name, null, null))
        .map(r => rosterId(r.no_rm)))
      ids.delete(null)
      if (ids.size === 1) {
        viaName.push(`${name} (sheet RM "${rm || '—'}")`)
        return [...ids][0]
      }
      if (ids.size > 1) return null
    }
    return null
  }

  const regioByPatient = new Map<string, string>()
  for (const r of roster) {
    const id = rosterId(r.no_rm)
    if (id && r.regio && REGIO.has(r.regio)) regioByPatient.set(id, r.regio)
  }

  // ── Existing Singkawang data ──────────────────────────────────────────────
  const existingPackages = await fetchAll<{
    id: string; patient_id: string; purchased_at: string; package_name: string; order_id: string | null; created_at: string
    t1: string | null; t2: string | null; t3: string | null; t4: string | null; t5: string | null
    t6: string | null; t7: string | null; t8: string | null; t9: string | null; t10: string | null
  }>((f, t) => supabase.from('patient_packages')
    .select('id, patient_id, purchased_at, package_name, order_id, created_at, t1, t2, t3, t4, t5, t6, t7, t8, t9, t10').eq('branch_id', BRANCH).order('id').range(f, t))
  // Same patient can buy two packages on one sheet date — their T dates tell them apart
  const pkgKey = (patient: string, purchased: string, name: string, t: (string | null)[]) =>
    `${patient}|${purchased}|${name}|${t.map(d => d ?? '').join(',')}`
  const pkgByKey = new Map(existingPackages.map(p => [
    pkgKey(p.patient_id, p.purchased_at, p.package_name, [p.t1, p.t2, p.t3, p.t4, p.t5, p.t6, p.t7, p.t8, p.t9, p.t10]), p.id,
  ]))
  const inAppPackages = existingPackages.filter(p => p.order_id)

  const existingVisits = await fetchAll<{
    id: string; patient_id: string; visit_date: string; visit_time: string | null; service_type: string | null
    attending_staff_id: string | null; notes: string | null
  }>((f, t) => supabase.from('patient_visits')
    .select('id, patient_id, visit_date, visit_time, service_type, attending_staff_id, notes').eq('branch_id', BRANCH).order('id').range(f, t))
  const visitKey = (p: string, d: string, t: string | null, s: string) => `${p}|${d}|${(t ?? '').slice(0, 5)}|${s}`
  const visitKeys = new Set(existingVisits.map(v => visitKey(v.patient_id, v.visit_date, v.visit_time, v.service_type ?? '')))

  const { data: staff } = await supabase.from('internal_profiles')
    .select('id, full_name, role, is_active').eq('branch_id', BRANCH)
  const therapistByFirstName = new Map<string, string>()
  for (const s of (staff ?? []).sort((a, b) => Number(b.is_active) - Number(a.is_active))) {
    const first = (s.full_name ?? '').trim().split(/\s+/)[0]?.toUpperCase()
    if (first && !therapistByFirstName.has(first)) therapistByFirstName.set(first, s.id)
  }

  const { data: slots } = await supabase.from('schedule_slots').select('shift, slot_time').eq('branch_id', BRANCH)
  const dividers = dividersFromSlots(slots ?? null)

  console.log(`   ${dbPatients.length} patients · ${existingPackages.length} Singkawang packages · ${existingVisits.length} Singkawang visits`)
  console.log(`   Therapist accounts: ${[...therapistByFirstName.keys()].join(', ') || 'none'}`)

  // ── Parse packages ────────────────────────────────────────────────────────
  // Columns: 0 TANGGAL, 1 BULAN, 2 NAMA, 3 RM, 4 JENIS, 5 MULAI, 6–15 T1–T10, 16 STATUS, 17 SELESAI, 18 CATATAN
  const unresolved: string[] = []
  const pkgSkippedExisting: string[] = []
  const pkgHandledInApp: string[] = []
  const pkgBad: string[] = []
  const packages: PackageRow[] = []
  const pkgRows = readSheet('DATA PAKET')
  for (let i = 1; i < pkgRows.length; i++) {
    const c = pkgRows[i] ?? []
    if (!str(c[2]) && !str(c[3])) continue
    const label = `${str(c[2])} (${str(c[3]) || '—'}, row ${i + 1})`
    const type = PACKAGE_TYPES[str(c[4]).toUpperCase()]
    const purchasedAt = anyDate(c[0])
    if (!type || !purchasedAt) { pkgBad.push(`${label}: jenis "${str(c[4])}" / tanggal "${str(c[0])}"`); continue }

    const patientId = resolvePatient(c[3], c[2])
    if (!patientId) { unresolved.push(`PAKET ${label}`); continue }

    const key = pkgKey(patientId, purchasedAt, type.package_name, c.slice(6, 16).map(serialToDate))
    const tDates = c.slice(6, 16).map(serialToDate).filter((d): d is string => !!d)
    const existingId = pkgByKey.get(key) ?? null
    if (existingId) pkgSkippedExisting.push(label)

    const sheetStatus = str(c[16]).toUpperCase()
    const selesai = str(c[17]).toUpperCase()
    let status = sheetStatus === 'AKTIF' || sheetStatus === 'PENDING' ? 'active' : selesai === 'STOP' ? 'stopped' : 'completed'
    let operational = sheetStatus === 'AKTIF' ? 'ON' : sheetStatus === 'PENDING' ? 'PENDING' : 'OFF'
    if (status === 'active' && inAppPackages.some(p => p.patient_id === patientId && p.created_at.slice(0, 10) >= purchasedAt)) {
      status = 'completed'
      operational = 'OFF'
      pkgHandledInApp.push(label)
    }

    const t: Record<string, string | null> = {}
    for (let n = 0; n < 10; n++) t[`t${n + 1}`] = serialToDate(c[6 + n])

    packages.push({
      rowNo: i + 1, key, patientId, label, existingId, tempId: `pkg-${i}`, tDates,
      freeTDates: new Set(tDates), linked: 0,
      insert: {
        patient_id:         patientId,
        branch_id:          BRANCH,
        package_name:       type.package_name,
        package_type:       'fixed',
        total_sessions:     type.total_sessions,
        jenis_paket:        type.jenis_paket,
        category:           type.category,
        mulai_paket:        str(c[5]).toUpperCase() === 'PERPANJANG' ? 'EXT.' : 'NEW',
        status,
        operational_status: operational,
        stopped_at:         status === 'stopped' ? tDates[tDates.length - 1] ?? purchasedAt : null,
        completion_status:  ['LANJUT', 'SEMBUH', 'TIDAK LANJUT', 'STOP'].includes(selesai) ? selesai : null,
        purchased_at:       purchasedAt,
        created_at:         `${purchasedAt}T00:00:00+07:00`,
        notes:              [str(c[18]), IMPORT_NOTE].filter(Boolean).join(' · '),
        order_id:           null,
        ...t,
      },
    })
  }
  // Same package listed twice in the sheet → keep the first
  const seenPkg = new Set<string>()
  const pkgDupes: string[] = []
  const uniquePackages = packages.filter(p => {
    if (seenPkg.has(p.key)) { pkgDupes.push(p.label); return false }
    seenPkg.add(p.key)
    return true
  })

  const packagesByPatient = new Map<string, PackageRow[]>()
  for (const p of uniquePackages) packagesByPatient.set(p.patientId, [...(packagesByPatient.get(p.patientId) ?? []), p])

  // ── Parse visits ──────────────────────────────────────────────────────────
  // Columns: 0 TANGGAL, 3 JAM, 4 LAYANAN, 5 NAMA, 8 RM, 11 DIAGNOSA, 12 TERAPIS, 13 KETERANGAN
  const visits: VisitRow[] = []
  const visitSkippedExisting: string[] = []
  const visitBad: string[] = []
  const unmappedTherapists = new Map<string, number>()
  const visitRows = readSheet('CATATAN PELAYANAN')
  for (let i = 1; i < visitRows.length; i++) {
    const c = visitRows[i] ?? []
    if (!str(c[5])) continue
    const label = `${str(c[5])} (${str(c[8]) || '—'}, row ${i + 1})`
    const date = anyDate(c[0])
    const service = SERVICE_TYPES[str(c[4]).toUpperCase()]
    if (!date || !service) { visitBad.push(`${label}: tanggal "${str(c[0])}" / layanan "${str(c[4])}"`); continue }

    const patientId = resolvePatient(c[8], c[5])
    if (!patientId) { unresolved.push(`VISIT ${label} ${date}`); continue }

    const time = toTime(c[3])
    const key = visitKey(patientId, date, time, service)
    if (visitKeys.has(key)) { visitSkippedExisting.push(label); continue }
    visitKeys.add(key)

    const terapis = str(c[12]).toUpperCase()
    const staffId = terapis ? therapistByFirstName.get(terapis) ?? null : null
    if (terapis && !staffId) unmappedTherapists.set(terapis, (unmappedTherapists.get(terapis) ?? 0) + 1)

    // Link paket visits to the package whose T dates include this day
    let packageTempId: string | null = null
    const category = VISIT_PACKAGE_CATEGORY[service]
    if (category) {
      const pkg = (packagesByPatient.get(patientId) ?? [])
        .filter(p => p.insert.category === category && p.freeTDates.has(date))
        .sort((a, b) => String(b.insert.purchased_at).localeCompare(String(a.insert.purchased_at)))[0]
      if (pkg) {
        pkg.freeTDates.delete(date)
        pkg.linked++
        packageTempId = pkg.tempId
      }
    }

    const past = date <= TODAY
    visits.push({
      rowNo: i + 1, label, patientId, packageTempId,
      insert: {
        patient_id:         patientId,
        branch_id:          BRANCH,
        visit_date:         date,
        visit_time:         time,
        shift:              time ? shiftForHour(parseInt(time, 10), dividers) : null,
        service_type:       service,
        status:             past ? 'completed' : 'scheduled',
        kehadiran:          past ? 'HADIR' : null,
        diagnosis:          str(c[11]) || null,
        regio:              regioByPatient.get(patientId) ?? null,
        attending_staff_id: staffId,
        notes:              [terapis && !staffId ? `Terapis: ${terapis}` : '', str(c[13])].filter(Boolean).join(' · ') || null,
      },
    })
  }

  // used_sessions = legacy + linked attended visits → keep it equal to the sheet's T count
  for (const p of uniquePackages) {
    const total = p.insert.total_sessions as number
    p.insert.legacy_used_sessions = Math.max(0, Math.min(p.tDates.length, total) - p.linked)
  }

  const newPackages = uniquePackages.filter(p => !p.existingId)
  const linkedVisits = visits.filter(v => v.packageTempId).length
  console.log(`\n📦 Packages: ${newPackages.length} new, ${pkgSkippedExisting.length} already imported`)
  console.log(`🩺 Visits:   ${visits.length} new (${linkedVisits} linked to a package), ${visitSkippedExisting.length} already present`)

  // ── Write ─────────────────────────────────────────────────────────────────
  const idByTemp = new Map<string, string>()
  for (const p of uniquePackages) if (p.existingId) idByTemp.set(p.tempId, p.existingId)
  const errors: string[] = []

  async function insertBatched<T extends { label: string }>(
    table: string, rows: T[], payload: (r: T) => Record<string, unknown>, onId?: (r: T, id: string) => void,
  ) {
    let done = 0
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200)
      const { data, error } = await supabase.from(table).insert(chunk.map(payload)).select('id')
      if (!error && data) {
        data.forEach((d, j) => onId?.(chunk[j], d.id))
        done += chunk.length
      } else {
        for (const r of chunk) { // isolate the bad row(s)
          const { data: one, error: e } = await supabase.from(table).insert(payload(r)).select('id').single()
          if (e) errors.push(`${table} ${r.label}: ${e.message}`)
          else { onId?.(r, one.id); done++ }
        }
      }
      process.stdout.write(`\r   ${table}: ${done}/${rows.length}`)
    }
    console.log()
  }

  let backfilled = 0
  if (!DRY_RUN) {
    console.log('\n⬆️  Writing...')
    await insertBatched('patient_packages', newPackages, p => p.insert, (p, id) => idByTemp.set(p.tempId, id))
    const insertable = visits.filter(v => !v.packageTempId || idByTemp.has(v.packageTempId))
    await insertBatched('patient_visits', insertable,
      v => ({ ...v.insert, package_id: v.packageTempId ? idByTemp.get(v.packageTempId) : null }))

    // Backfill therapists on previously imported visits once their account exists
    for (const v of existingVisits) {
      const m = v.notes?.match(/^Terapis: ([A-Z]+)/)
      const id = m ? therapistByFirstName.get(m[1]) : undefined
      if (v.attending_staff_id || !id) continue
      const notes = v.notes!.replace(/^Terapis: [A-Z]+( · )?/, '') || null
      const { error } = await supabase.from('patient_visits').update({ attending_staff_id: id, notes }).eq('id', v.id)
      if (error) errors.push(`backfill ${v.id}: ${error.message}`)
      else backfilled++
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55))
  console.log(DRY_RUN ? '🧪 Dry run complete!' : '🎉 Import complete!')
  const byStatus: Record<string, number> = {}
  for (const p of newPackages) {
    const k = `${p.insert.package_name} ${p.insert.status}/${p.insert.operational_status}`
    byStatus[k] = (byStatus[k] ?? 0) + 1
  }
  console.log('   Packages by type/status:', byStatus)
  if (!DRY_RUN) console.log(`   Therapist backfills: ${backfilled}`)
  console.log(`   ❌ Errors: ${errors.length}`)

  const dump = (title: string, list: string[], max = 200) => {
    if (!list.length) return
    console.log(`\n${title} (${list.length}):`)
    for (const s of list.slice(0, max)) console.log(`   - ${s}`)
    if (list.length > max) console.log(`   … ${list.length - max} more`)
  }
  dump('⚠️  Unresolved patient (skipped — fix RM in sheet or add Paket Penyesuaian)', unresolved)
  dump('🔎 Matched by name (RM missing/typo in sheet)', [...new Set(viaName)])
  dump('🛑 Active in sheet but admin already created an in-app package → imported as completed', pkgHandledInApp)
  dump('↷  Package listed twice in sheet', pkgDupes)
  dump('⚠️  Unparseable package rows', pkgBad)
  dump('⚠️  Unparseable visit rows', visitBad)
  dump('👤 Therapists without a Singkawang account (kept as "Terapis: X" in notes)',
    [...unmappedTherapists].map(([n, c]) => `${n}: ${c} visits`))
  const unlinkedPaket = visits.filter(v => VISIT_PACKAGE_CATEGORY[v.insert.service_type as string] && !v.packageTempId).length
  console.log(`\n   Paket visits without a matching package T date: ${unlinkedPaket}`)
  dump('⚠️  Errors', errors)
}

main().catch((e) => { console.error(e); process.exit(1) })
