import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { encryptPatientPII, hashPhone } from '@/lib/encryption'
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
  kelurahan:      ['kelurahan', 'kelurahan/desa', 'kel./desa'],
  kecamatan:      ['kecamatan'],
  kabupaten_kota: ['kab/kota', 'kabupaten/kota', 'kabupaten kota', 'kab. kota', 'kab./kota'],
  provinsi:       ['provinsi', 'province'],
} as const

type ColKey = keyof typeof COL

function buildHeaderMap(headers: string[]): Map<ColKey, number> {
  const map = new Map<ColKey, number>()
  headers.forEach((h, i) => {
    const norm = String(h ?? '').trim().toLowerCase()
    for (const [key, aliases] of Object.entries(COL) as [ColKey, readonly string[]][]) {
      if (aliases.includes(norm) && !map.has(key)) map.set(key, i)
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

function cellStr(row: (string | number | boolean | null | undefined)[], idx: number | undefined): string {
  if (idx === undefined || row[idx] == null) return ''
  const v = row[idx]
  if (v instanceof Date) return (v as Date).toISOString().split('T')[0]
  return String(v).trim()
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

// ---------- SSE helpers ----------

const enc = new TextEncoder()

function sseEvent(data: Record<string, unknown>): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`)
}

// ---------- Route handler ----------

const BATCH = 100

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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── 1. Parse Excel ──────────────────────────────────────────────────
        controller.enqueue(sseEvent({ phase: 'parsing', message: 'Membaca file Excel...' }))

        const buffer = await file.arrayBuffer()
        let workbook: XLSX.WorkBook
        try {
          workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
        } catch {
          controller.enqueue(sseEvent({ error: 'Gagal membaca file Excel' }))
          controller.close()
          return
        }

        const sheetName =
          workbook.SheetNames.find((n) => n.toLowerCase().includes('pasien')) ??
          workbook.SheetNames[0]

        if (!sheetName) {
          controller.enqueue(sseEvent({ error: 'File Excel tidak memiliki sheet' }))
          controller.close()
          return
        }

        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          defval: null,
        })

        if (rows.length < 2) {
          controller.enqueue(sseEvent({ done: true, imported: 0, skipped: 0, errors: 0, sheetUsed: sheetName }))
          controller.close()
          return
        }

        const headers = (rows[0] as string[]).map((h) => (h ? String(h) : ''))
        const hMap = buildHeaderMap(headers)
        const dataRows = rows.slice(1) as (string | number | boolean | null | undefined)[][]

        // ── 2. Deduplicate within Excel ─────────────────────────────────────
        controller.enqueue(sseEvent({ phase: 'deduplicating', message: 'Memproses baris data...' }))

        type InsertRow = Record<string, unknown>
        const seenHashes = new Set<string>()
        const seenRms    = new Set<string>()
        const candidates: { hash: string; no_rm: string | null; record: InsertRow }[] = []

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i]
          const name  = cellStr(row, hMap.get('name'))
          const phone = cellStr(row, hMap.get('phone'))
          if (!name || !phone || !/\d/.test(phone)) continue

          const hash = hashPhone(phone)
          if (seenHashes.has(hash)) continue
          seenHashes.add(hash)

          const no_rm = cellStr(row, hMap.get('no_rm')) || null
          const effectiveRm = (no_rm && !seenRms.has(no_rm)) ? no_rm : null
          if (no_rm && effectiveRm) seenRms.add(no_rm)

          const address   = cellStr(row, hMap.get('address'))   || undefined
          const birthDate = cellStr(row, hMap.get('birthDate')) || undefined
          const genderRaw = cellStr(row, hMap.get('gender'))
          const gender    = normalizeGender(genderRaw)
          const enc2      = encryptPatientPII({ name, phone, address, birthDate })

          candidates.push({
            hash,
            no_rm: effectiveRm,
            record: {
              encrypted_name:       enc2.encrypted_name,
              encrypted_phone:      enc2.encrypted_phone,
              encrypted_address:    enc2.encrypted_address    ?? null,
              encrypted_birth_date: enc2.encrypted_birth_date ?? null,
              phone_hash:           hash,
              gender,
              no_rm:          effectiveRm,
              pekerjaan:      cellStr(row, hMap.get('pekerjaan'))      || null,
              agama:          cellStr(row, hMap.get('agama'))          || null,
              hobi:           cellStr(row, hMap.get('hobi'))           || null,
              kelurahan:      cellStr(row, hMap.get('kelurahan'))      || null,
              kecamatan:      cellStr(row, hMap.get('kecamatan'))      || null,
              kabupaten_kota: cellStr(row, hMap.get('kabupaten_kota')) || null,
              provinsi:       cellStr(row, hMap.get('provinsi'))       || null,
            },
          })
        }

        controller.enqueue(sseEvent({
          phase: 'deduplicating',
          message: `${candidates.length} pasien unik ditemukan di file`,
          totalInFile: candidates.length,
        }))

        // ── 3. Batch-fetch existing records from DB ─────────────────────────
        controller.enqueue(sseEvent({ phase: 'checking', message: 'Mengambil data pasien yang sudah ada...' }))

        const [existingHashes, existingRms] = await Promise.all([
          fetchAllColumn(supabase, 'phone_hash'),
          fetchAllColumn(supabase, 'no_rm'),
        ])

        const toInsert = candidates
          .filter(c => !existingHashes.has(c.hash))
          .map(c => {
            if (c.no_rm && existingRms.has(c.no_rm)) {
              return { ...c.record, no_rm: null }
            }
            return c.record
          })

        const skippedCount = candidates.length - toInsert.length

        controller.enqueue(sseEvent({
          phase: 'checking',
          message: `${skippedCount} sudah terdaftar, ${toInsert.length} baru akan diimport`,
          total: toInsert.length,
          skipped: skippedCount,
        }))

        if (toInsert.length === 0) {
          controller.enqueue(sseEvent({ done: true, imported: 0, skipped: skippedCount, errors: 0, sheetUsed: sheetName }))
          controller.close()
          return
        }

        // ── 4. Insert in batches with progress ─────────────────────────────
        let imported = 0
        let errors = 0

        for (let i = 0; i < toInsert.length; i += BATCH) {
          const batch = toInsert.slice(i, i + BATCH)
          const { error: insertError } = await supabase.from('patients').insert(batch)

          if (insertError) {
            // Fallback: row-by-row
            for (const rec of batch) {
              const { error: e2 } = await supabase.from('patients').insert([rec])
              if (e2) errors++
              else imported++
            }
          } else {
            imported += batch.length
          }

          controller.enqueue(sseEvent({
            phase: 'importing',
            imported,
            errors,
            skipped: skippedCount,
            total: toInsert.length,
            processed: Math.min(i + BATCH, toInsert.length),
          }))
        }

        controller.enqueue(sseEvent({
          done: true,
          imported,
          skipped: skippedCount,
          errors,
          sheetUsed: sheetName,
        }))
      } catch (e) {
        controller.enqueue(sseEvent({ error: String(e) }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
