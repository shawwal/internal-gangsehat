import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { decrypt } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/server'

// ── Package type mapping from PEMBELIAN column ──────────────────────────────
const PACKAGE_MAP: Record<string, { package_name: string; jenis_paket: 'P1' | 'P2' | null; total_sessions: number }> = {
  'K.PT - PAKET 1':            { package_name: 'PAKET 1',            jenis_paket: 'P1',  total_sessions: 5  },
  'K.PT - PAKET 2':            { package_name: 'PAKET 2',            jenis_paket: 'P2',  total_sessions: 10 },
  'K.PT - PAKET SILVER':       { package_name: 'PAKET SILVER',       jenis_paket: null,  total_sessions: 5  },
  'K.PT - PAKET GOLD':         { package_name: 'PAKET GOLD',         jenis_paket: null,  total_sessions: 10 },
  'K.PT - PAKET PLATINUM':     { package_name: 'PAKET PLATINUM',     jenis_paket: null,  total_sessions: 20 },
  'K.PT - PAKET KHUSUS':       { package_name: 'PAKET KHUSUS',       jenis_paket: null,  total_sessions: 5  },
  'K.PT - PAKET PENYESUAIAN':  { package_name: 'PAKET PENYESUAIAN',  jenis_paket: null,  total_sessions: 5  },
  'K.L - PAKET GOLD':          { package_name: 'PAKET GOLD',         jenis_paket: null,  total_sessions: 10 },
  'K.L - PAKET SILVER':        { package_name: 'PAKET SILVER',       jenis_paket: null,  total_sessions: 5  },
  'STUDIO.SKOLIOSIS - PAKET SILVER': { package_name: 'PAKET SILVER SKOLIOSIS', jenis_paket: null, total_sessions: 5 },
}

function normalizeName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ')
}

// Convert Excel date serial number to ISO date string
function excelDateToIso(serial: number): string | null {
  if (!serial || isNaN(serial) || serial < 40000) return null
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
  return d.toISOString().split('T')[0]
}

const enc = new TextEncoder()
function sseEvent(data: Record<string, unknown>): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`)
}

const PATIENT_PAGE = 500
const PKG_PAGE = 500

// ── Route handler ───────────────────────────────────────────────────────────
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
  const branchId = formData.get('branchId') as string | null

  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
  if (!branchId) return NextResponse.json({ error: 'Cabang belum dipilih' }, { status: 400 })

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── 1. Parse Excel ────────────────────────────────────────────────
        controller.enqueue(sseEvent({ phase: 'parsing', message: 'Membaca file Excel...' }))

        const buffer = await file.arrayBuffer()
        let workbook: XLSX.WorkBook
        try {
          workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
        } catch {
          controller.enqueue(sseEvent({ error: 'Gagal membaca file Excel. Pastikan format .xlsx atau .xls.' }))
          controller.close()
          return
        }

        // Find the PEMASUKAN sheet (priority: contains "pemasukan", else first sheet)
        const sheetName =
          workbook.SheetNames.find((n) => n.toLowerCase().includes('pemasukan')) ??
          workbook.SheetNames[0]

        if (!sheetName) {
          controller.enqueue(sseEvent({ error: 'File Excel tidak memiliki sheet.' }))
          controller.close()
          return
        }

        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          defval: null,
        })

        // Auto-detect header row (first row containing "NAMA PASIEN")
        let headerRowIdx = -1
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          if (rows[i]?.some((c) => String(c ?? '').toUpperCase().includes('NAMA PASIEN'))) {
            headerRowIdx = i
            break
          }
        }

        if (headerRowIdx === -1) {
          controller.enqueue(sseEvent({
            error: `Sheet "${sheetName}" tidak memiliki kolom NAMA PASIEN. Pastikan file menggunakan format CATATAN KEUANGAN.`,
          }))
          controller.close()
          return
        }

        const headers = (rows[headerRowIdx] as (string | null)[]).map((h) =>
          String(h ?? '').toUpperCase().trim()
        )
        const namaIdx     = headers.indexOf('NAMA PASIEN')
        const pembelianIdx = headers.indexOf('PEMBELIAN')
        const tanggalIdx  = headers.indexOf('TANGGAL')

        if (namaIdx === -1 || pembelianIdx === -1) {
          controller.enqueue(sseEvent({ error: 'Kolom NAMA PASIEN atau PEMBELIAN tidak ditemukan.' }))
          controller.close()
          return
        }

        const dataRows = rows.slice(headerRowIdx + 1) as (string | number | boolean | null | undefined)[][]

        // ── 2. Filter PAKET rows and deduplicate ──────────────────────────
        controller.enqueue(sseEvent({ phase: 'deduplicating', message: 'Memfilter dan deduplikasi baris paket...' }))

        type PkgCandidate = {
          rawName:       string
          package_name:  string
          jenis_paket:   'P1' | 'P2' | null
          total_sessions: number
          tanggal:       string | null
        }

        const seen = new Set<string>()
        const candidates: PkgCandidate[] = []

        for (const row of dataRows) {
          if (!row) continue
          const rawNama     = String(row[namaIdx]     ?? '').trim()
          const rawPembelian = String(row[pembelianIdx] ?? '').trim()
          if (!rawNama || !rawPembelian) continue

          const pkg = PACKAGE_MAP[rawPembelian]
          if (!pkg) continue // not a package type we import

          // One package per patient+package_name combination
          const key = normalizeName(rawNama) + '|' + pkg.package_name
          if (seen.has(key)) continue
          seen.add(key)

          const tanggal = tanggalIdx !== -1
            ? excelDateToIso(Number(row[tanggalIdx] ?? 0))
            : null

          candidates.push({ rawName: rawNama, ...pkg, tanggal })
        }

        controller.enqueue(sseEvent({
          phase: 'deduplicating',
          message: `${candidates.length} paket unik ditemukan di file`,
          totalInFile: candidates.length,
        }))

        if (candidates.length === 0) {
          controller.enqueue(sseEvent({
            done: true, imported: 0, skipped: 0, notFound: 0, errors: 0, sheetUsed: sheetName,
          }))
          controller.close()
          return
        }

        // ── 3. Build patient name → id lookup (server-side decrypt) ────────
        controller.enqueue(sseEvent({ phase: 'checking', message: 'Memuat dan mendekripsi nama pasien...' }))

        const nameToId = new Map<string, string>() // normalized_name → patient_id
        let patFrom = 0

        while (true) {
          const { data: batch, error } = await supabase
            .from('patients')
            .select('id, encrypted_name')
            .eq('is_active', true)
            .range(patFrom, patFrom + PATIENT_PAGE - 1)

          if (error || !batch?.length) break

          for (const p of batch) {
            if (!p.encrypted_name) continue
            try {
              const name = decrypt(p.encrypted_name)
              if (name) nameToId.set(normalizeName(name), p.id)
            } catch { /* skip un-decryptable */ }
          }

          if (batch.length < PATIENT_PAGE) break
          patFrom += PATIENT_PAGE
        }

        controller.enqueue(sseEvent({
          phase: 'checking',
          message: `${nameToId.size} pasien aktif dimuat`,
        }))

        // ── 4. Load existing packages to prevent duplicates ─────────────────
        controller.enqueue(sseEvent({ phase: 'checking', message: 'Memeriksa paket yang sudah ada di database...' }))

        const existingPkgs = new Set<string>() // "patient_id|package_name"
        let pkgFrom = 0

        while (true) {
          const { data: pkgBatch, error } = await supabase
            .from('patient_packages')
            .select('patient_id, package_name')
            .range(pkgFrom, pkgFrom + PKG_PAGE - 1)

          if (error || !pkgBatch?.length) break
          for (const p of pkgBatch as { patient_id: string; package_name: string }[]) {
            existingPkgs.add(`${p.patient_id}|${p.package_name}`)
          }
          if (pkgBatch.length < PKG_PAGE) break
          pkgFrom += PKG_PAGE
        }

        // ── 5. Insert packages ──────────────────────────────────────────────
        controller.enqueue(sseEvent({
          phase: 'importing',
          message: 'Mengimpor paket...',
          total: candidates.length,
          processed: 0,
          imported: 0, skipped: 0, notFound: 0, errors: 0,
        }))

        let imported = 0
        let skipped  = 0
        let notFound = 0
        let errors   = 0

        for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i]
          const norm = normalizeName(c.rawName)
          const patientId = nameToId.get(norm)

          if (!patientId) {
            notFound++
            controller.enqueue(sseEvent({
              phase: 'importing',
              processed: i + 1, total: candidates.length,
              imported, skipped, notFound, errors,
            }))
            continue
          }

          const existKey = `${patientId}|${c.package_name}`
          if (existingPkgs.has(existKey)) {
            skipped++
            controller.enqueue(sseEvent({
              phase: 'importing',
              processed: i + 1, total: candidates.length,
              imported, skipped, notFound, errors,
            }))
            continue
          }

          const createdAt = c.tanggal
            ? new Date(c.tanggal).toISOString()
            : new Date().toISOString()

          const { error: insertErr } = await supabase.from('patient_packages').insert({
            patient_id:         patientId,
            branch_id:          branchId,
            package_name:       c.package_name,
            package_type:       'fixed',
            total_sessions:     c.total_sessions,
            jenis_paket:        c.jenis_paket,
            mulai_paket:        'NEW',
            operational_status: 'ON',
            status:             'active',
            created_at:         createdAt,
            updated_at:         new Date().toISOString(),
          })

          if (insertErr) {
            errors++
          } else {
            imported++
            existingPkgs.add(existKey) // prevent duplicate in same run
          }

          controller.enqueue(sseEvent({
            phase: 'importing',
            processed: i + 1, total: candidates.length,
            imported, skipped, notFound, errors,
          }))
        }

        controller.enqueue(sseEvent({
          done: true, imported, skipped, notFound, errors, sheetUsed: sheetName,
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
