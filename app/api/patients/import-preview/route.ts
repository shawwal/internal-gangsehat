import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { hashPhone } from '@/lib/encryption'
import { normalizeBirthDate } from '@/lib/dates'
import { matchLocation } from '@/lib/patient-location-match'
import { createClient } from '@/lib/supabase/server'

// ---------- Column header aliases ----------

const COL = {
  no_rm:          ['no.rm', 'no rm', 'nomer rm', 'nomor rm', 'no. rm'],
  name:           ['nama', 'name', 'nama pasien'],
  phone:          ['no. hp', 'no hp', 'nomer hp', 'nomor hp', 'hp', 'phone', 'telepon',
                   'no. hp/whatsapp', 'no. hp/wa', 'no. whatsapp', 'no. wa', 'whatsapp'],
  address:        ['alamat', 'address'],
  birthDate:      ['tgl lahir', 'tanggal lahir', 'birth date', 'birthdate'],
  gender:         ['jk', 'jenis kelamin', 'gender'],
  pekerjaan:      ['pekerjaan', 'occupation'],
  agama:          ['agama', 'religion'],
  hobi:           ['hobi', 'hobby', 'hobi/aktivitas sehari-hari', 'hobi/aktivitas'],
  keluhan:        ['keluhan', 'chief complaint'],
  kelurahan:      ['kelurahan', 'kelurahan/desa', 'kel./desa', 'kel. / desa'],
  kecamatan:      ['kecamatan'],
  kabupaten_kota: ['kab/kota', 'kabupaten/kota', 'kabupaten kota', 'kab. kota', 'kab./kota'],
  provinsi:       ['provinsi', 'province'],
} as const

type ColKey = keyof typeof COL
type Cell = string | number | boolean | Date | null | undefined

function buildHeaderMap(headers: string[]): Map<ColKey, number> {
  const map = new Map<ColKey, number>()
  headers.forEach((h, i) => {
    const norm = String(h ?? '').trim().toLowerCase()
    for (const [key, aliases] of Object.entries(COL) as [ColKey, readonly string[]][]) {
      if ((aliases as readonly string[]).includes(norm) && !map.has(key)) map.set(key, i)
    }
  })
  return map
}

function normalizeGender(raw: string): 'male' | 'female' | 'other' {
  const v = raw.trim().toLowerCase()
  if (['l', 'laki-laki', 'laki', 'male', 'm'].includes(v)) return 'male'
  if (['p', 'perempuan', 'female', 'f'].includes(v)) return 'female'
  return 'other'
}

function cellStr(row: Cell[], idx: number | undefined): string {
  if (idx === undefined || row[idx] == null) return ''
  const v = row[idx]
  if (v instanceof Date) return excelDateToIso(v) ?? ''
  return String(v).trim()
}

function excelDateToIso(v: Date): string | null {
  const y = v.getUTCFullYear()
  const m = String(v.getUTCMonth() + 1).padStart(2, '0')
  const d = String(v.getUTCDate()).padStart(2, '0')
  if (!y || y < 1900) return null
  return `${y}-${m}-${d}`
}

function cellBirthDate(row: Cell[], idx: number | undefined): string {
  if (idx === undefined || row[idx] == null) return ''
  const v = row[idx]
  if (v instanceof Date) return excelDateToIso(v) ?? ''
  return normalizeBirthDate(String(v)) ?? ''
}

// Phone numbers stored as a numeric Excel cell lose their leading 0
// (e.g. "085157405563" becomes the number 85157405563).
function cellPhone(row: Cell[], idx: number | undefined): string {
  if (idx === undefined || row[idx] == null) return ''
  const raw = row[idx]
  let s = String(raw).trim()
  if (!s) return ''
  if (typeof raw === 'number' && /^\d+$/.test(s) && s.startsWith('8')) {
    s = '0' + s
  }
  return s
}

async function fetchAllColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  column: string,
): Promise<Set<string>> {
  const result = new Set<string>()
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('patients')
      .select(column)
      .range(from, from + PAGE - 1)
    if (error) break
    if (!data || data.length === 0) break
    for (const row of data) {
      const v = row[column as keyof typeof row]
      if (v) result.add(String(v))
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return result
}

export interface PreviewRow {
  tempId: string
  no_rm: string | null
  no_rm_cleared: boolean
  name: string
  phone: string
  gender: 'male' | 'female' | 'other'
  birthDate: string
  address: string
  provinsi: string
  kabupatenKota: string
  kecamatan: string
  kelurahan: string
  agama: string
  pekerjaan: string
  hobi: string
  keluhan: string
  duplicateInDb: boolean
  locationMatch: { provinsi: boolean; kabupatenKota: boolean; kecamatan: boolean }
  sourceRow: number
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden — director only' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch {
    return NextResponse.json({ error: 'Gagal membaca file Excel' }, { status: 400 })
  }

  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes('pasien')) ??
    workbook.SheetNames[0]

  if (!sheetName) {
    return NextResponse.json({ error: 'File Excel tidak memiliki sheet' }, { status: 400 })
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null })

  if (rows.length < 2) {
    return NextResponse.json({ sheetUsed: sheetName, totalRows: 0, skippedInvalid: 0, rows: [] })
  }

  const headers = (rows[0] as string[]).map((h) => (h ? String(h) : ''))
  const hMap = buildHeaderMap(headers)
  const dataRows = rows.slice(1) as Cell[][]

  const [existingHashes, existingRms] = await Promise.all([
    fetchAllColumn(supabase, 'phone_hash'),
    fetchAllColumn(supabase, 'no_rm'),
  ])

  const seenHashes = new Set<string>()
  const seenRms    = new Set<string>()
  const previewRows: PreviewRow[] = []
  let skippedInvalid = 0

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const name  = cellStr(row, hMap.get('name'))
    const phone = cellPhone(row, hMap.get('phone'))

    if (!name || !phone || !/\d/.test(phone)) {
      // Blank template rows / stray legend values (no name+phone) are noise, not data.
      if (name || phone) skippedInvalid++
      continue
    }

    const hash = hashPhone(phone)
    if (seenHashes.has(hash)) continue
    seenHashes.add(hash)

    const rawNoRm = cellStr(row, hMap.get('no_rm')) || null
    let no_rm = rawNoRm
    let no_rm_cleared = false
    if (rawNoRm && (seenRms.has(rawNoRm) || existingRms.has(rawNoRm))) {
      no_rm = null
      no_rm_cleared = true
    } else if (rawNoRm) {
      seenRms.add(rawNoRm)
    }

    const rawProvinsi  = cellStr(row, hMap.get('provinsi'))
    const rawKabupaten = cellStr(row, hMap.get('kabupaten_kota'))
    const rawKecamatan = cellStr(row, hMap.get('kecamatan'))
    const loc = matchLocation(rawProvinsi, rawKabupaten, rawKecamatan)

    previewRows.push({
      tempId: `row-${i}`,
      no_rm,
      no_rm_cleared,
      name,
      phone,
      gender: normalizeGender(cellStr(row, hMap.get('gender'))),
      birthDate: cellBirthDate(row, hMap.get('birthDate')),
      address: cellStr(row, hMap.get('address')),
      provinsi: loc.provinsi,
      kabupatenKota: loc.kabupatenKota,
      kecamatan: loc.kecamatan,
      kelurahan: cellStr(row, hMap.get('kelurahan')),
      agama: cellStr(row, hMap.get('agama')),
      pekerjaan: cellStr(row, hMap.get('pekerjaan')),
      hobi: cellStr(row, hMap.get('hobi')),
      keluhan: cellStr(row, hMap.get('keluhan')),
      duplicateInDb: existingHashes.has(hash),
      locationMatch: {
        provinsi: loc.provinsiMatched,
        kabupatenKota: loc.kabupatenMatched,
        kecamatan: loc.kecamatanMatched,
      },
      sourceRow: i + 2, // +1 for header, +1 for 1-based row numbers
    })
  }

  return NextResponse.json({
    sheetUsed: sheetName,
    totalRows: dataRows.length,
    skippedInvalid,
    rows: previewRows,
  })
}
