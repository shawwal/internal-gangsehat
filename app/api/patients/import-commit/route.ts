import { NextRequest, NextResponse } from 'next/server'
import { encryptPatientPII, hashPhone } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/server'

interface CommitRow {
  no_rm: string | null
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

const enc = new TextEncoder()
function sseEvent(data: Record<string, unknown>): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`)
}

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

  let body: { rows?: CommitRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const inputRows = Array.isArray(body.rows) ? body.rows : []
  if (inputRows.length === 0) {
    return NextResponse.json({ error: 'Tidak ada baris untuk diimpor' }, { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sseEvent({ phase: 'checking', message: 'Memeriksa duplikat...' }))

        const [existingHashes, existingRms] = await Promise.all([
          fetchAllColumn(supabase, 'phone_hash'),
          fetchAllColumn(supabase, 'no_rm'),
        ])

        const seenHashes = new Set<string>()
        const seenRms = new Set<string>()
        type InsertRow = Record<string, unknown>
        const toInsert: InsertRow[] = []
        let skipped = 0

        for (const row of inputRows) {
          const name = (row.name ?? '').trim()
          const phone = (row.phone ?? '').trim()
          if (!name || !phone || !/\d/.test(phone)) { skipped++; continue }

          const hash = hashPhone(phone)
          if (seenHashes.has(hash) || existingHashes.has(hash)) { skipped++; continue }
          seenHashes.add(hash)

          let no_rm = row.no_rm?.trim() || null
          if (no_rm && (seenRms.has(no_rm) || existingRms.has(no_rm))) no_rm = null
          if (no_rm) seenRms.add(no_rm)

          const encPii = encryptPatientPII({
            name,
            phone,
            address: row.address?.trim() || undefined,
            birthDate: row.birthDate?.trim() || undefined,
          })

          toInsert.push({
            encrypted_name:       encPii.encrypted_name,
            encrypted_phone:      encPii.encrypted_phone,
            encrypted_address:    encPii.encrypted_address    ?? null,
            encrypted_birth_date: encPii.encrypted_birth_date ?? null,
            phone_hash:           hash,
            gender:               row.gender,
            no_rm,
            pekerjaan:      row.pekerjaan?.trim()      || null,
            agama:          row.agama?.trim()          || null,
            hobi:           row.hobi?.trim()           || null,
            keluhan:        row.keluhan?.trim()        || null,
            kelurahan:      row.kelurahan?.trim()      || null,
            kecamatan:      row.kecamatan?.trim()      || null,
            kabupaten_kota: row.kabupatenKota?.trim()  || null,
            provinsi:       row.provinsi?.trim()       || null,
          })
        }

        if (toInsert.length === 0) {
          controller.enqueue(sseEvent({ done: true, imported: 0, skipped, errors: 0 }))
          controller.close()
          return
        }

        let imported = 0
        let errors = 0

        for (let i = 0; i < toInsert.length; i += BATCH) {
          const batch = toInsert.slice(i, i + BATCH)
          const { error: insertError } = await supabase.from('patients').insert(batch)

          if (insertError) {
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
            skipped,
            total: toInsert.length,
            processed: Math.min(i + BATCH, toInsert.length),
          }))
        }

        controller.enqueue(sseEvent({ done: true, imported, skipped, errors }))
      } catch (e) {
        controller.enqueue(sseEvent({ error: String(e) }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
