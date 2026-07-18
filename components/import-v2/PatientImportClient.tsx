'use client'

import { useRef, useState } from 'react'
import { FileUp, AlertCircle, Loader2, Save, CheckCircle2, RotateCcw } from 'lucide-react'
import { PreviewSummary } from './PreviewSummary'
import { PatientEditTable } from './PatientEditTable'
import { CommitProgressBlock } from './CommitProgressBlock'
import type { EditableRow, PreviewResponse, CommitProgress, CommitResult } from './types'

type Step = 'idle' | 'parsing' | 'preview' | 'committing' | 'done'

export function PatientImportClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ sheetUsed: string; totalRows: number; skippedInvalid: number } | null>(null)
  const [rows, setRows] = useState<EditableRow[]>([])
  const [progress, setProgress] = useState<CommitProgress | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)

  async function handleFileSelected(file: File) {
    setStep('parsing')
    setError(null)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/patients/import-preview', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Terjadi kesalahan saat membaca file')
        setStep('idle')
        return
      }

      const preview = json as PreviewResponse
      setMeta({ sheetUsed: preview.sheetUsed, totalRows: preview.totalRows, skippedInvalid: preview.skippedInvalid })
      setRows(preview.rows.map((r) => ({ ...r, include: !r.duplicateInDb })))
      setStep('preview')
    } catch (e) {
      setError(String(e))
      setStep('idle')
    }
  }

  function updateRow(tempId: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)))
  }

  function removeRow(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId))
  }

  function toggleAll(include: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, include })))
  }

  function reset() {
    setStep('idle')
    setError(null)
    setMeta(null)
    setRows([])
    setProgress(null)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCommit() {
    const included = rows.filter((r) => r.include)
    if (included.length === 0) {
      setError('Pilih minimal satu pasien untuk diimpor.')
      return
    }

    setStep('committing')
    setError(null)
    setProgress(null)

    try {
      const res = await fetch('/api/patients/import-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: included }),
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Terjadi kesalahan saat menyimpan')
        setStep('preview')
        return
      }

      const reader = res.body.getReader()
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
            setError(String(event.error))
            setStep('preview')
            break
          }

          if (event.done) {
            setResult({
              imported: Number(event.imported ?? 0),
              skipped: Number(event.skipped ?? 0),
              errors: Number(event.errors ?? 0),
            })
            setStep('done')
            break
          }

          setProgress({
            phase: 'importing',
            imported: Number(event.imported ?? 0),
            skipped: Number(event.skipped ?? 0),
            errors: Number(event.errors ?? 0),
            total: Number(event.total ?? 0),
            processed: Number(event.processed ?? 0),
          })
        }
      }
    } catch (e) {
      setError(String(e))
      setStep('preview')
    }
  }

  const includedCount = rows.filter((r) => r.include).length

  return (
    <div className="space-y-5">
      {step === 'idle' && (
        <div className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Upload File Excel</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Mendukung format template dengan kolom Tanggal, No. RM, Nama Pasien, Usia, Tanggal Lahir, Jenis
              Kelamin, Alamat, Kel./Desa, Kecamatan, Kab. Kota, Provinsi, Agama, Pekerjaan, Keluhan, Hobi/Aktivitas, dan No. WA.
              Baris tanpa nama atau no. HP otomatis dilewati.
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelected(f)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:bg-muted transition-colors text-sm text-muted-foreground"
          >
            <FileUp size={14} />
            Pilih file Excel...
          </button>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
      )}

      {step === 'parsing' && (
        <div className="glass-card p-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 size={20} className="animate-spin text-primary" />
          Membaca dan mencocokkan lokasi...
        </div>
      )}

      {(step === 'preview' || step === 'committing' || step === 'done') && meta && (
        <>
          <PreviewSummary sheetUsed={meta.sheetUsed} totalRows={meta.totalRows} skippedInvalid={meta.skippedInvalid} rows={rows} />

          {step === 'preview' && (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Pilih semua
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Batal pilih semua
                  </button>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                >
                  <RotateCcw size={12} />
                  Upload file lain
                </button>
              </div>

              <PatientEditTable rows={rows} onChange={updateRow} onRemove={removeRow} />

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleCommit}
                disabled={includedCount === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                <Save size={14} />
                Simpan {includedCount} pasien ke database
              </button>
            </>
          )}

          {step === 'committing' && (
            <div className="glass-card p-5">
              <CommitProgressBlock committing progress={progress} />
            </div>
          )}

          {step === 'done' && result && (
            <div className="glass-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 size={16} className="text-chart-4" />
                Import selesai
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
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                <RotateCcw size={14} />
                Import file lain
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
