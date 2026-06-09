'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, FileUp, RefreshCw, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react'
import { backfillPhoneHashes } from '@/app/actions/patients'

type Phase = 'parsing' | 'deduplicating' | 'checking' | 'importing'

type Progress = {
  phase: Phase
  message: string
  total: number       // new records to insert
  totalInFile: number // unique records found in file
  processed: number   // batches processed so far
  imported: number
  skipped: number
  errors: number
}

type ImportResult = {
  imported: number
  skipped: number
  errors: number
  sheetUsed: string
}

const PHASE_LABEL: Record<Phase, string> = {
  parsing:       'Membaca file...',
  deduplicating: 'Memproses data...',
  checking:      'Memeriksa duplikat...',
  importing:     'Mengimpor...',
}

export default function ImportPasienPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]             = useState<File | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [progress, setProgress]     = useState<Progress | null>(null)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [backfilling, setBackfilling]       = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ updated: number; errors: number } | null>(null)

  async function handleBackfill() {
    setBackfilling(true)
    setBackfillResult(null)
    try {
      const res = await backfillPhoneHashes()
      setBackfillResult(res)
    } finally {
      setBackfilling(false)
    }
  }

  async function handleImport() {
    if (!file) return
    setUploading(true)
    setProgress(null)
    setResult(null)
    setImportError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/patients/import', { method: 'POST', body: fd })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        setImportError(json.error ?? 'Terjadi kesalahan saat import')
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.error) {
            setImportError(String(event.error))
            break
          }

          if (event.done) {
            setResult({
              imported:  Number(event.imported ?? 0),
              skipped:   Number(event.skipped  ?? 0),
              errors:    Number(event.errors   ?? 0),
              sheetUsed: String(event.sheetUsed ?? ''),
            })
            break
          }

          setProgress(prev => ({
            phase:       (event.phase as Phase) ?? prev?.phase ?? 'parsing',
            message:     String(event.message ?? prev?.message ?? ''),
            total:       Number(event.total       ?? prev?.total       ?? 0),
            totalInFile: Number(event.totalInFile ?? prev?.totalInFile ?? 0),
            processed:   Number(event.processed   ?? prev?.processed   ?? 0),
            imported:    Number(event.imported    ?? prev?.imported    ?? 0),
            skipped:     Number(event.skipped     ?? prev?.skipped     ?? 0),
            errors:      Number(event.errors      ?? prev?.errors      ?? 0),
          }))
        }
      }
    } catch (e) {
      setImportError(String(e))
    } finally {
      setUploading(false)
    }
  }

  const pct = progress?.total
    ? Math.round((progress.processed / progress.total) * 100)
    : 0

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/patients" className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Data Pasien</h1>
          <p className="text-sm text-muted-foreground">Upload file Excel untuk menambah data pasien secara massal</p>
        </div>
      </div>

      {/* Backfill card */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sinkronkan Hash Telepon</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Jalankan sekali setelah migrasi untuk mengisi kolom <code className="text-xs bg-muted px-1 rounded">phone_hash</code> pada pasien yang sudah ada, sehingga deteksi duplikat di portal gangsehat.com berfungsi.
          </p>
        </div>

        {backfillResult && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={14} className="text-chart-4 shrink-0" />
            <span className="text-foreground">
              <span className="font-semibold text-chart-4">{backfillResult.updated}</span> pasien diperbarui
              {backfillResult.errors > 0 && (
                <span className="text-destructive ml-2">{backfillResult.errors} error</span>
              )}
            </span>
          </div>
        )}

        <button
          onClick={handleBackfill}
          disabled={backfilling}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={backfilling ? 'animate-spin' : ''} />
          {backfilling ? 'Memproses...' : 'Jalankan Backfill'}
        </button>
      </div>

      {/* Upload card */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Upload File Excel</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Format: <code className="text-xs bg-muted px-1 rounded">.xlsx</code> atau <code className="text-xs bg-muted px-1 rounded">.xls</code>.
            Sheet bernama <strong>Pasien</strong> akan diprioritaskan (atau sheet pertama jika tidak ada).
          </p>
        </div>

        {/* Expected columns info */}
        <details className="text-xs">
          <summary className="cursor-pointer flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors select-none">
            <Info size={12} /> Kolom yang dikenali
          </summary>
          <div className="mt-2 p-3 bg-muted/50 rounded-xl text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">Header Excel yang dikenali (tidak case-sensitif):</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <li><span className="font-mono">NO.RM / No. RM</span> — No. Rekam Medis</li>
              <li><span className="font-mono">NAMA / Nama Pasien</span> — Nama <span className="text-primary">*</span></li>
              <li><span className="font-mono">NO. HP / No. HP/WhatsApp / No. WA</span> — Telepon <span className="text-primary">*</span></li>
              <li><span className="font-mono">ALAMAT</span> — Alamat</li>
              <li><span className="font-mono">TGL LAHIR / Tanggal Lahir</span> — Tgl. Lahir</li>
              <li><span className="font-mono">JK / Jenis Kelamin</span> — Gender</li>
              <li><span className="font-mono">PEKERJAAN</span> — Pekerjaan</li>
              <li><span className="font-mono">AGAMA</span> — Agama</li>
              <li><span className="font-mono">HOBI / Hobi/Aktivitas Sehari-hari</span> — Hobi</li>
              <li><span className="font-mono">KELURAHAN / Kelurahan/Desa</span> — Kelurahan</li>
              <li><span className="font-mono">KECAMATAN</span> — Kecamatan</li>
              <li><span className="font-mono">KAB/KOTA / Kabupaten/Kota</span> — Kab./Kota</li>
              <li><span className="font-mono">PROVINSI</span> — Provinsi</li>
            </ul>
            <p className="mt-1.5 text-primary/80"><span className="text-primary">*</span> Wajib ada. Baris tanpa Nama atau No. HP akan dilewati.</p>
          </div>
        </details>

        {/* File picker */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setProgress(null)
              setResult(null)
              setImportError(null)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:bg-muted transition-colors text-sm text-muted-foreground disabled:opacity-60"
          >
            <FileUp size={14} />
            {file ? file.name : 'Pilih file Excel...'}
          </button>
          {file && (
            <p className="text-xs text-muted-foreground mt-1">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>

        {importError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {importError}
          </div>
        )}

        {/* Live progress */}
        {uploading && progress && (
          <div className="space-y-3 p-4 bg-muted/40 rounded-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 size={12} className="animate-spin shrink-0" />
                {PHASE_LABEL[progress.phase]}
              </span>
              {progress.phase === 'importing' && progress.total > 0 && (
                <span className="text-foreground font-medium tabular-nums">{pct}%</span>
              )}
            </div>

            {/* Progress bar — only shown during insert phase */}
            {progress.phase === 'importing' && progress.total > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">{progress.message}</p>

            {/* Live counters */}
            {progress.phase === 'importing' && (
              <div className="flex gap-4 text-xs tabular-nums">
                <span className="text-chart-4 font-medium">✓ {progress.imported} berhasil</span>
                <span className="text-muted-foreground">↷ {progress.skipped} dilewati</span>
                {progress.errors > 0 && (
                  <span className="text-destructive">✕ {progress.errors} error</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Simple spinner before first progress event */}
        {uploading && !progress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/40 rounded-xl">
            <Loader2 size={14} className="animate-spin shrink-0" />
            Mengunggah file...
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {uploading
            ? <Loader2 size={14} className="animate-spin" />
            : <FileUp size={14} />}
          {uploading ? 'Mengimpor...' : 'Upload & Import'}
        </button>
      </div>

      {/* Result card */}
      {result && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Hasil Import — sheet &quot;{result.sheetUsed}&quot;
          </h2>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-chart-4/10 text-chart-4 text-sm font-medium">
              <CheckCircle2 size={14} />
              Berhasil: {result.imported}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/20 text-secondary-foreground text-sm font-medium">
              <Info size={14} />
              Dilewati: {result.skipped}
            </div>
            {result.errors > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
                <AlertCircle size={14} />
                Error: {result.errors}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
