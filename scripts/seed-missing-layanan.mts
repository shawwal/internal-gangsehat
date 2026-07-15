/**
 * Seed missing layanan (services) into internal_layanan for FGS Pontianak,
 * ported from the old admin panel's Layanan table (only 2 of 12 had migrated).
 * Run: npx tsx scripts/seed-missing-layanan.mts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envRaw = readFileSync(join(__dirname, '../.env'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']  ?? ''
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

const BRANCH_NAME = 'Fisioterapi Gang Sehat Pontianak'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const MISSING_LAYANAN = [
  { nama: 'Paket Khusus',      kategori: 'PAKET KLINIK', jumlah_sesi: 10, harga: 500000 },
  { nama: 'Paket Platinum',    kategori: 'PAKET KLINIK', jumlah_sesi: 20, harga: 2400000 },
  { nama: 'Paket Gold',        kategori: 'PAKET KLINIK', jumlah_sesi: 10, harga: 1300000 },
  { nama: 'Paket Silver',      kategori: 'PAKET KLINIK', jumlah_sesi: 5,  harga: 750000 },
  { nama: 'Paket Penyesuaian', kategori: 'SESI KLINIK',  jumlah_sesi: 3,  harga: 0 },
  { nama: 'Paket Home Visit',  kategori: 'PAKET VISIT',  jumlah_sesi: 10, harga: 1800000 },
  { nama: 'Home Visit',        kategori: 'TA VISIT',     jumlah_sesi: 1,  harga: 300000 },
  { nama: 'Paket 2',           kategori: 'PAKET KLINIK', jumlah_sesi: 10, harga: 1200000 },
  { nama: 'Paket 1',           kategori: 'PAKET KLINIK', jumlah_sesi: 5,  harga: 650000 },
  { nama: 'Sesi',              kategori: 'SESI KLINIK',  jumlah_sesi: 1,  harga: 150000 },
]

async function main() {
  const { data: branch, error: branchErr } = await supabase
    .from('branches')
    .select('id, name')
    .eq('name', BRANCH_NAME)
    .single()

  if (branchErr || !branch) {
    console.error('Branch not found:', BRANCH_NAME, branchErr)
    process.exit(1)
  }

  const { data: existing } = await supabase
    .from('internal_layanan')
    .select('nama')
    .eq('branch_id', branch.id)

  const existingNames = new Set((existing ?? []).map((r) => r.nama.trim().toLowerCase()))

  const toInsert = MISSING_LAYANAN.filter((l) => !existingNames.has(l.nama.trim().toLowerCase()))

  if (toInsert.length === 0) {
    console.log('Nothing to insert — all layanan already exist.')
    return
  }

  const { data, error } = await supabase
    .from('internal_layanan')
    .insert(toInsert.map((l) => ({ ...l, branch_id: branch.id, is_active: true })))
    .select('nama, kategori, jumlah_sesi, harga')

  if (error) {
    console.error('Insert failed:', error)
    process.exit(1)
  }

  console.log(`Inserted ${data?.length ?? 0} layanan into ${branch.name}:`)
  for (const row of data ?? []) {
    console.log(`  - ${row.nama} (${row.kategori}) x${row.jumlah_sesi ?? '-'} @ Rp${row.harga}`)
  }
}

main()
