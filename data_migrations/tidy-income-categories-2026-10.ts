/**
 * One-off tidy-up from the Oct 2026 price-list audit (income category/price
 * vs each branch's internal_layanan). Phase 0 of "income categories come from
 * the branch price list".
 *
 *  B1. Singkawang price list → same conventions as Pontianak:
 *      - "PAKET MIX SM" (sport-massage package) PAKET KLINIK → PAKET SPORT MASSAGE
 *      - "PAKET MIX" (Rp 0 placeholder, SPORT MASSAGE) → inactive
 *      - "TERAPI PERTEMUAN AWAL PAKET (TA)" (Rp 0, TA KLINIK) → inactive
 *      - add a paid "TERAPI AWAL" (TA KLINIK, Rp 175.000 — the only paid
 *        Singkawang TA on record)
 *      None of these rows are referenced by patient_visits / online_bookings /
 *      payroll_activity_types (checked before writing this). Nothing is deleted.
 *
 *  C1. Pontianak: 11 sport-massage PACKAGE payments filed as SPORT MASSAGE
 *      (typed by hand before the PAKET SPORT MASSAGE tariffs existed)
 *      → PAKET SPORT MASSAGE.
 *  C2. Griya Anak: two harga typos (×10) on 19 Sep DP rows.
 *  C3. Singkawang: package payments filed as TA KLINIK → PAKET KLINIK
 *      (they were counting as TA sales).
 *
 * Every write is guarded by the values the audit saw, so a row someone has
 * already corrected by hand is skipped, and re-running is a no-op.
 * Refuses to apply if a touched row falls inside a locked PFOTM period or a
 * non-draft payroll period.
 *
 * Rows that need a human decision are printed as a checklist at the end.
 *
 * Defaults to DRY RUN. Pass --apply to write.
 *
 *   npx tsx data_migrations/tidy-income-categories-2026-10.ts            # dry run
 *   npx tsx data_migrations/tidy-income-categories-2026-10.ts --apply    # writes
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
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const PONTIANAK  = 'cfe27e13-ba0b-440d-99f3-03e059efb877'
const SINGKAWANG = 'b44b322b-07e1-4d00-a118-47c34eefb7c6'
const GRIYA      = 'ff7ca797-633d-4c35-8e5b-f50949669198'

// ── B1: Singkawang price list ────────────────────────────────────────────────

interface LayananFix {
  nama: string
  expect: { kategori: string; harga: number; is_active: boolean }
  patch: { kategori?: string; is_active?: boolean }
}

const SKW_LAYANAN_FIXES: LayananFix[] = [
  { nama: 'PAKET MIX SM', expect: { kategori: 'PAKET KLINIK', harga: 725000, is_active: true }, patch: { kategori: 'PAKET SPORT MASSAGE' } },
  { nama: 'PAKET MIX', expect: { kategori: 'SPORT MASSAGE', harga: 0, is_active: true }, patch: { is_active: false } },
  { nama: 'TERAPI PERTEMUAN AWAL PAKET (TA)', expect: { kategori: 'TA KLINIK', harga: 0, is_active: true }, patch: { is_active: false } },
]

const SKW_NEW_TA = { nama: 'TERAPI AWAL', kategori: 'TA KLINIK', jumlah_sesi: 1, harga: 175000 }

// ── C: transactions ─────────────────────────────────────────────────────────

interface TxFix {
  id: string
  group: 'C1' | 'C2' | 'C3'
  branch_id: string
  expect: { category: string; harga: number }
  patch: { category?: string; harga?: number }
}

const sm = (id: string, harga: number): TxFix => ({
  id, group: 'C1', branch_id: PONTIANAK,
  expect: { category: 'SPORT MASSAGE', harga },
  patch: { category: 'PAKET SPORT MASSAGE' },
})
const skwPaket = (id: string, harga: number): TxFix => ({
  id, group: 'C3', branch_id: SINGKAWANG,
  expect: { category: 'TA KLINIK', harga },
  patch: { category: 'PAKET KLINIK' },
})

const TX_FIXES: TxFix[] = [
  // C1 — "PAKET SM COMBO" / "Paket Combo SM Full" / "PAKET SM SEGMENTAL"
  sm('9578cbd9-f91e-4222-9b0e-3a45db8a853e', 440000),
  sm('d614b0b9-b307-44f2-8fa3-025e73110909', 440000),
  sm('2f37cc5b-294c-4ecb-af38-a163898f2071', 440000),
  sm('37121851-67f2-4025-b6d7-9a24ba188d5d', 460000),
  sm('13c0028d-126f-47c1-a6ff-11c4aaaa3fb2', 460000),
  sm('311b7900-10ab-4921-9827-78ee894d56cb', 460000),
  sm('29627117-df14-4bc5-a79a-bdd8af01099e', 460000),
  sm('bb64cbd1-8e1f-4254-b101-efc93ca3c7b2', 525000),
  sm('601e9335-8999-4f2d-95e0-b363fe1bbdf7', 525000),
  sm('edd3b242-c55c-4288-b547-5f468db612d3', 525000),
  sm('8805bbaa-1e3c-44dd-9de9-b3897a464ee5', 525000),

  // C2 — harga typed ×10 (amount paid is right)
  { id: '33b57f7a-2b48-45cc-8f6e-b1f633b246b3', group: 'C2', branch_id: GRIYA,
    expect: { category: 'PAKET KLINIK', harga: 15000000 }, patch: { harga: 1500000 } },
  { id: '811987df-618b-4f5a-a01b-f2d373e0b089', group: 'C2', branch_id: GRIYA,
    expect: { category: 'SESI KLINIK', harga: 1800000 }, patch: { harga: 180000 } },

  // C3 — package payments on a TA visit. 9a1ba997 is left for review (see checklist).
  skwPaket('8ec3aad0-c01b-4dfe-a8d9-f50ab71756e9', 1400000), // "PAKET 2"
  skwPaket('b6b1b475-8bb1-4553-bb71-8aaa85969e95', 1000000), // "dp paket 2"
  skwPaket('bc4bdc1a-d6f0-43f3-b962-7fb0637a8555', 750000),  // "dp paket 1"
]

const REVIEW_CHECKLIST = [
  'Singkawang patient 9f8ae738…: 7 rows for one Rp 750k PAKET 1 (DP bc4bdc1a 300k + pelunasan 41a1b1d8 450k look real;',
  '   c34489fa harga 75k/amount 300k, 9a1ba997, db1454b0, bc3c84f1, 49edd6b1 look like repeat attempts) and TWO active',
  '   packages ("PAKET 1" 22 Okt + "Paket Fisio P1" 24 Okt). Keep one package, reject/delete the extra rows.',
  'Singkawang PELUNASAN rows with harga = installment instead of package price: 98de2fd5 (350k), 8a52b304 (1M).',
  '   Convention: harga = full package price on every installment, amount = paid now.',
  'Singkawang Rp 0 rows: SESI KLINIK b527d494 / 9671c4e3 / 1ceaa605, PAKET KLINIK ac887955, TA KLINIK 4735a3a7 / 22464763.',
  '   Convention for free visits: harga = tariff, discount = tariff.',
  'Pontianak 0dde2c03: PAKET KLINIK "Paket Silver" Rp 450k LUNAS — Silver costs 750k (pelunasan with wrong harga/status?).',
  'Pontianak future-dated rows from the 25 Jul import (fix the year from the Excel source):',
  '   e9edd19f 2062-04-14, c258bab2 2050-04-30, 7fac179a 2052-02-25, 63191548 2049-01-16, c7ee32fb 2054-02-13, 833015da 2032-07-20.',
  'Pontianak price list: fill Sesi for "Paket Combo 1/2 Sports Massage"; confirm "TUKAR TUNAI" as income LAINNYA;',
  '   double space in "Paket Home Visit Fisioterapi  + Jarak".',
]

// ── Locks ─────────────────────────────────────────────────────────────────────

async function lockedConflicts(rows: { branch_id: string; transaction_date: string; id: string }[]) {
  const [{ data: pfotm }, { data: payroll }] = await Promise.all([
    supabase.from('pfotm_periods').select('branch_id, start_date, end_date').eq('is_locked', true),
    supabase.from('payroll_periods').select('branch_id, start_date, end_date, status').neq('status', 'draft'),
  ])
  const locks = [
    ...(pfotm ?? []).map((p) => ({ ...p, kind: 'PFOTM locked' })),
    ...(payroll ?? []).map((p) => ({ ...p, kind: `payroll ${p.status}` })),
  ]
  const out: string[] = []
  for (const r of rows) {
    for (const l of locks) {
      if (l.branch_id === r.branch_id && r.transaction_date >= l.start_date && r.transaction_date <= l.end_date) {
        out.push(`${r.id.slice(0, 8)} (${r.transaction_date}) inside ${l.kind} ${l.start_date}..${l.end_date}`)
      }
    }
  }
  return out
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY RUN (pass --apply to write) ===')

  // B1
  console.log('\n[B1] Singkawang price list')
  const { data: skwLayanan, error: layErr } = await supabase
    .from('internal_layanan')
    .select('id, nama, kategori, harga, is_active')
    .eq('branch_id', SINGKAWANG)
  if (layErr) throw layErr

  for (const fix of SKW_LAYANAN_FIXES) {
    const row = (skwLayanan ?? []).find((l) => l.nama === fix.nama)
    if (!row) { console.log(`  skip  "${fix.nama}": not found`); continue }
    const matches = row.kategori === fix.expect.kategori && Number(row.harga) === fix.expect.harga && row.is_active === fix.expect.is_active
    const done = Object.entries(fix.patch).every(([k, v]) => (row as Record<string, unknown>)[k] === v)
    if (done) { console.log(`  done  "${fix.nama}": already ${JSON.stringify(fix.patch)}`); continue }
    if (!matches) { console.log(`  skip  "${fix.nama}": changed since audit (${row.kategori}, ${row.harga}, active=${row.is_active})`); continue }
    console.log(`  fix   "${fix.nama}": ${JSON.stringify(fix.patch)}`)
    if (APPLY) {
      const { error } = await supabase.from('internal_layanan').update(fix.patch).eq('id', row.id)
      if (error) throw error
    }
  }

  const hasPaidTa = (skwLayanan ?? []).some((l) => l.kategori === 'TA KLINIK' && l.is_active && Number(l.harga) > 0)
  if (hasPaidTa) {
    console.log('  done  paid TA KLINIK already exists')
  } else {
    console.log(`  add   "${SKW_NEW_TA.nama}" ${SKW_NEW_TA.kategori} Rp ${SKW_NEW_TA.harga.toLocaleString('id-ID')}`)
    if (APPLY) {
      const { error } = await supabase.from('internal_layanan').insert({ ...SKW_NEW_TA, branch_id: SINGKAWANG, is_active: true })
      if (error) throw error
    }
  }

  // C
  const { data: txRows, error: txErr } = await supabase
    .from('transactions')
    .select('id, branch_id, category, harga, amount, transaction_date, description')
    .in('id', TX_FIXES.map((f) => f.id))
  if (txErr) throw txErr
  const byId = new Map((txRows ?? []).map((t) => [t.id, t]))

  const toApply: TxFix[] = []
  for (const group of ['C1', 'C2', 'C3'] as const) {
    console.log(`\n[${group}]`)
    for (const fix of TX_FIXES.filter((f) => f.group === group)) {
      const t = byId.get(fix.id)
      const tag = fix.id.slice(0, 8)
      if (!t) { console.log(`  skip  ${tag}: not found`); continue }
      if (t.branch_id !== fix.branch_id) { console.log(`  skip  ${tag}: unexpected branch`); continue }
      const done = Object.entries(fix.patch).every(([k, v]) => (k === 'harga' ? Number(t.harga) === v : (t as Record<string, unknown>)[k] === v))
      if (done) { console.log(`  done  ${tag}`); continue }
      if (t.category !== fix.expect.category || Number(t.harga) !== fix.expect.harga) {
        console.log(`  skip  ${tag}: changed since audit (${t.category}, ${t.harga})`)
        continue
      }
      console.log(`  fix   ${tag} ${t.transaction_date} ${t.category} Rp ${Number(t.harga).toLocaleString('id-ID')} ${JSON.stringify(t.description)} → ${JSON.stringify(fix.patch)}`)
      toApply.push(fix)
    }
  }

  const conflicts = await lockedConflicts(toApply.map((f) => byId.get(f.id)!))
  if (conflicts.length) {
    console.log('\n!! Rows inside locked periods — not applying transaction fixes:')
    for (const c of conflicts) console.log('   ' + c)
  } else if (APPLY) {
    for (const fix of toApply) {
      const { error } = await supabase
        .from('transactions')
        .update(fix.patch)
        .eq('id', fix.id)
        .eq('category', fix.expect.category)
        .eq('harga', fix.expect.harga)
      if (error) throw new Error(`${fix.id}: ${error.message}`)
    }
    console.log(`\nUpdated ${toApply.length} transaction(s).`)
  } else {
    console.log(`\n${toApply.length} transaction(s) would be updated.`)
  }

  console.log('\n[Checklist for the admin team — not changed by this script]')
  for (const line of REVIEW_CHECKLIST) console.log(line.startsWith('   ') ? '  ' + line : '  - ' + line)
}

main().catch((e) => { console.error(e); process.exit(1) })
