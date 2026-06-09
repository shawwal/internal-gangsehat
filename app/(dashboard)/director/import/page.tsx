'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, FileUp, RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { backfillPhoneHashes } from '@/app/actions/patients'

type ImportResult = {
  imported: number
  skipped: { row: number; name: string; reason: string }[]
  errors:  { row: number; name: string; reason: string }[]
  sheetUsed: string
}

export default function ImportPasienPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]               = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [backfilling, setBackfilling]   = useState(false)
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
    setResult(null)
    setImportError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/patients/import', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setImportError(json.error ?? 'Terjadi kesalahan saat import')
      } else {
        setResult(json as ImportResult)
      }
    } catch (e) {
      setImportError(String(e))
    } finally {
      setUploading(false)
    }
  }

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
            <p className="font-medium text-foreground mb-1">Header Excel (tidak case-sensitif):</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <li><span className="font-mono">NO.RM</span> — No. Rekam Medis</li>
              <li><span className="font-mono">NAMA</span> — Nama <span className="text-primary">*</span></li>
              <li><span className="font-mono">NO. HP</span> — No. Telepon <span className="text-primary">*</span></li>
              <li><span className="font-mono">ALAMAT</span> — Alamat</li>
              <li><span className="font-mono">TGL LAHIR</span> — Tanggal Lahir</li>
              <li><span className="font-mono">JK</span> — Jenis Kelamin (L/P)</li>
              <li><span className="font-mono">PEKERJAAN</span> — Pekerjaan</li>
              <li><span className="font-mono">AGAMA</span> — Agama</li>
              <li><span className="font-mono">HOBI</span> — Hobi</li>
              <li><span className="font-mono">KELURAHAN</span> — Kelurahan</li>
              <li><span className="font-mono">KECAMATAN</span> — Kecamatan</li>
              <li><span className="font-mono">KAB/KOTA</span> — Kab./Kota</li>
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
              setResult(null)
              setImportError(null)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:bg-muted transition-colors text-sm text-muted-foreground"
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

        <button
          onClick={handleImport}
          disabled={!file || uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          <FileUp size={14} />
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
              Dilewati: {result.skipped.length}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
              <AlertCircle size={14} />
              Error: {result.errors.length}
            </div>
          </div>

          {result.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground select-none">
                Lihat baris dilewati ({result.skipped.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.skipped.map((s, i) => (
                  <div key={i} className="text-xs flex gap-2 text-muted-foreground">
                    <span className="shrink-0 w-10 text-right">Baris {s.row}</span>
                    <span className="font-medium text-foreground truncate max-w-[160px]">{s.name}</span>
                    <span className="text-secondary-foreground">{s.reason}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {result.errors.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-destructive hover:text-destructive/80 select-none">
                Lihat error ({result.errors.length})
              </summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs flex gap-2 text-muted-foreground">
                    <span className="shrink-0 w-10 text-right">Baris {e.row}</span>
                    <span className="font-medium text-foreground truncate max-w-[160px]">{e.name}</span>
                    <span className="text-destructive">{e.reason}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
