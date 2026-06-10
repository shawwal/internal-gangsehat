'use client'

import { useRef, useState } from 'react'
import { FileUp, AlertCircle, Loader2 } from 'lucide-react'
import { ColumnInfo } from './ColumnInfo'
import { ProgressBlock } from './ProgressBlock'
import type { Phase, Progress, ImportResult } from './types'

export function UploadCard() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]               = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [progress, setProgress]       = useState<Progress | null>(null)
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const pct = progress?.total
    ? Math.round((progress.processed / progress.total) * 100)
    : 0

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

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Upload File Excel</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Format: <code className="text-xs bg-muted px-1 rounded">.xlsx</code> atau <code className="text-xs bg-muted px-1 rounded">.xls</code>.
          Sheet bernama <strong>Pasien</strong> akan diprioritaskan (atau sheet pertama jika tidak ada).
        </p>
      </div>

      <ColumnInfo />

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

      <ProgressBlock uploading={uploading} progress={progress} pct={pct} />

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

      {result && (
        <div className="space-y-4 pt-2 border-t border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Hasil Import — sheet &quot;{result.sheetUsed}&quot;
          </h2>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-chart-4/10 text-chart-4 text-sm font-medium">
              Berhasil: {result.imported}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/20 text-secondary-foreground text-sm font-medium">
              Dilewati: {result.skipped}
            </div>
            {result.errors > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
                Error: {result.errors}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
