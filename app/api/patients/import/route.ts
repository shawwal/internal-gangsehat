import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { encryptPatientPII, hashPhone } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/server'

// ---------- Column header aliases (case-insensitive, trimmed) ----------

const COL = {
  no_rm:          ['no.rm', 'no rm', 'nomer rm', 'nomor rm', 'no. rm'],
  name:           ['nama', 'name'],
  phone:          ['no. hp', 'no hp', 'nomer hp', 'nomor hp', 'hp', 'phone', 'telepon'],
  address:        ['alamat', 'address'],
  birthDate:      ['tgl lahir', 'tanggal lahir', 'birth date', 'birthdate'],
  gender:         ['jk', 'jenis kelamin', 'gender'],
  pekerjaan:      ['pekerjaan', 'occupation'],
  agama:          ['agama', 'religion'],
  hobi:           ['hobi', 'hobby'],
  kelurahan:      ['kelurahan'],
  kecamatan:      ['kecamatan'],
  kabupaten_kota: ['kab/kota', 'kabupaten/kota', 'kabupaten kota', 'kab. kota'],
  provinsi:       ['provinsi', 'province'],
} as const

type ColKey = keyof typeof COL

function buildHeaderMap(headers: string[]): Map<ColKey, number> {
  const map = new Map<ColKey, number>()
  headers.forEach((h, i) => {
    const normalized = h.trim().toLowerCase()
    for (const [key, aliases] of Object.entries(COL) as [ColKey, readonly string[]][]) {
      if (aliases.includes(normalized)) {
        if (!map.has(key)) map.set(key, i)
      }
    }
  })
  return map
}

function normalizeGender(raw: string): 'male' | 'female' | 'other' | null {
  const v = raw.trim().toLowerCase()
  if (v === 'l' || v === 'laki-laki' || v === 'laki' || v === 'male' || v === 'm') return 'male'
  if (v === 'p' || v === 'perempuan' || v === 'female' || v === 'f') return 'female'
  if (v) return 'other'
  return null
}

function cellStr(row: (string | number | boolean | null | undefined)[], idx: number | undefined): string {
  if (idx === undefined || row[idx] === undefined || row[idx] === null) return ''
  return String(row[idx]).trim()
}

// ---------- Route handler ----------

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth guard — director only
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

  // Parse file
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

  // Find the right sheet — prefer "Pasien", fallback to first sheet
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes('pasien')) ??
    workbook.SheetNames[0]

  if (!sheetName) {
    return NextResponse.json({ error: 'File Excel tidak memiliki sheet' }, { status: 400 })
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: null,
  })

  if (rows.length < 2) {
    return NextResponse.json({ imported: 0, skipped: [], errors: [], sheetUsed: sheetName })
  }

  // Build header map from first row
  const headers = (rows[0] as string[]).map((h) => (h ? String(h) : ''))
  const hMap = buildHeaderMap(headers)

  type SkipError = { row: number; name: string; reason: string }
  const skipped: SkipError[] = []
  const errors: SkipError[] = []
  let imported = 0

  // Collect hashes to check in bulk — but we process in batches anyway
  const BATCH = 50
  const dataRows = rows.slice(1) as (string | number | boolean | null | undefined)[][]

  for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH) {
    const batch = dataRows.slice(batchStart, batchStart + BATCH)
    const inserts: Record<string, unknown>[] = []
    const batchMeta: { rowNum: number; name: string }[] = []

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i]
      const rowNum = batchStart + i + 2 // 1-indexed, accounting for header row

      const name  = cellStr(row, hMap.get('name'))
      const phone = cellStr(row, hMap.get('phone'))

      // Skip completely empty rows silently
      if (!name && !phone) continue

      if (!name || !phone) {
        errors.push({ row: rowNum, name: name || '(kosong)', reason: 'Nama atau No. HP kosong' })
        continue
      }

      const hash = hashPhone(phone)

      // Check for existing phone_hash in DB
      const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('phone_hash', hash)
        .maybeSingle()

      if (existing) {
        skipped.push({ row: rowNum, name, reason: 'No. HP sudah terdaftar' })
        continue
      }

      // Check no_rm conflict
      const no_rm = cellStr(row, hMap.get('no_rm')) || null
      if (no_rm) {
        const { data: existingRm } = await supabase
          .from('patients')
          .select('id')
          .eq('no_rm', no_rm)
          .maybeSingle()
        if (existingRm) {
          skipped.push({ row: rowNum, name, reason: `No. RM ${no_rm} sudah terdaftar` })
          continue
        }
      }

      const address   = cellStr(row, hMap.get('address'))   || undefined
      const birthDate = cellStr(row, hMap.get('birthDate')) || undefined
      const genderRaw = cellStr(row, hMap.get('gender'))
      const gender    = normalizeGender(genderRaw) ?? 'other'

      const enc = encryptPatientPII({ name, phone, address, birthDate })

      inserts.push({
        encrypted_name:       enc.encrypted_name,
        encrypted_phone:      enc.encrypted_phone,
        encrypted_address:    enc.encrypted_address    ?? null,
        encrypted_birth_date: enc.encrypted_birth_date ?? null,
        phone_hash:           hash,
        gender,
        no_rm,
        pekerjaan:      cellStr(row, hMap.get('pekerjaan'))      || null,
        agama:          cellStr(row, hMap.get('agama'))          || null,
        hobi:           cellStr(row, hMap.get('hobi'))           || null,
        kelurahan:      cellStr(row, hMap.get('kelurahan'))      || null,
        kecamatan:      cellStr(row, hMap.get('kecamatan'))      || null,
        kabupaten_kota: cellStr(row, hMap.get('kabupaten_kota')) || null,
        provinsi:       cellStr(row, hMap.get('provinsi'))       || null,
      })
      batchMeta.push({ rowNum, name })
    }

    if (inserts.length === 0) continue

    const { error: insertError } = await supabase.from('patients').insert(inserts)
    if (insertError) {
      // If batch insert fails, record all rows in this batch as errors
      for (const meta of batchMeta) {
        errors.push({ row: meta.rowNum, name: meta.name, reason: insertError.message })
      }
    } else {
      imported += inserts.length
    }
  }

  return NextResponse.json({ imported, skipped, errors, sheetUsed: sheetName })
}
