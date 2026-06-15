'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, FileUp, Loader2, AlertCircle,
  Package, CheckCircle2, XCircle, UserX, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Branch } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'parsing' | 'deduplicating' | 'checking' | 'importing'

interface Progress {
  phase:       Phase
  message:     string
  total:       number
  totalInFile: number
  processed:   number
  imported:    number
  skipped:     number
  notFound:    number
  errors:      number
}

interface ImportResult {
  imported:   number
  skipped:    number
  notFound:   number
  errors:     number
  sheetUsed:  string
}

const PHASE_LABEL: Record<Phase, string> = {
  parsing:       'Membaca file...',
  deduplicating: 'Memproses data...',
  checking:      'Memeriksa database...',
  importing:     'Mengimpor...',
}

// ── Package type reference ─────────────────────────────────────────────────────
const PKG_TYPES = [
  { pembelian: 'K.PT - PAKET 1',           name: 'PAKET 1',           sesi: 5,  jenis: 'P1' },
  { pembelian: 'K.PT - PAKET 2',           name: 'PAKET 2',           sesi: 10, jenis: 'P2' },
  { pembelian: 'K.PT - PAKET SILVER',      name: 'PAKET SILVER',      sesi: 5,  jenis: '—'  },
  { pembelian: 'K.PT - PAKET GOLD',        name: 'PAKET GOLD',        sesi: 10, jenis: '—'  },
  { pembelian: 'K.PT - PAKET PLATINUM',    name: 'PAKET PLATINUM',    sesi: 20, jenis: '—'  },
  { pembelian: 'K.PT - PAKET KHUSUS',      name: 'PAKET KHUSUS',      sesi: 5,  jenis: '—'  },
  { pembelian: 'K.PT - PAKET PENYESUAIAN', name: 'PAKET PENYESUAIAN', sesi: 5,  jenis: '—'  },
  { pembelian: 'K.L - PAKET GOLD',         name: 'PAKET GOLD',        sesi: 10, jenis: '—'  },
  { pembelian: 'K.L - PAKET SILVER',       name: 'PAKET SILVER',      sesi: 5,  jenis: '—'  },
]

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ImportPackagesPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [branches, setBranches]       = useState<Branch[]>([])
  const [branchId, setBranchId]       = useState('')
  const [file, setFile]               = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [progress, setProgress]       = useState<Progress | null>(null)
  const [result, setResult]           = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [showInfo, setShowInfo]       = useState(false)

  useEffect(() => {
    createClient()
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setBranches((data as Branch[]) ?? [])
        if (data?.length === 1) setBranchId(data[0].id)
      })
  }, [])

  const pct = progress?.total
    ? Math.round((progress.processed / progress.total) * 100)
    : 0

  async function handleImport() {
    if (!file || !branchId) return
    setUploading(true)
    setProgress(null)
    setResult(null)
    setImportError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('branchId', branchId)

      const res = await fetch('/api/packages/import', { method: 'POST', body: fd })

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

          if (event.error) { setImportError(String(event.error)); break }

          if (event.done) {
            setResult({
              imported:  Number(event.imported  ?? 0),
              skipped:   Number(event.skipped   ?? 0),
              notFound:  Number(event.notFound  ?? 0),
              errors:    Number(event.errors    ?? 0),
              sheetUsed: String(event.sheetUsed ?? ''),
            })
            break
          }

          setProgress((prev) => ({
            phase:       (event.phase as Phase) ?? prev?.phase ?? 'parsing',
            message:     String(event.message    ?? prev?.message    ?? ''),
            total:       Number(event.total       ?? prev?.total       ?? 0),
            totalInFile: Number(event.totalInFile ?? prev?.totalInFile ?? 0),
            processed:   Number(event.processed   ?? prev?.processed   ?? 0),
            imported:    Number(event.imported    ?? prev?.imported    ?? 0),
            skipped:     Number(event.skipped     ?? prev?.skipped     ?? 0),
            notFound:    Number(event.notFound    ?? prev?.notFound    ?? 0),
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

  const canImport = !!file && !!branchId && !uploading

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/director/import"
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Paket Terapi</h1>
          <p className="text-sm text-muted-foreground">
            Upload sheet <strong>PEMASUKAN</strong> dari file Catatan Keuangan untuk mengimpor paket pasien
          </p>
        </div>
      </div>

      {/* Column info toggle */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info size={15} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Format Excel yang Didukung</span>
          </div>
          <span className="text-xs text-muted-foreground">{showInfo ? '▲ Sembunyikan' : '▼ Lihat detail'}</span>
        </button>

        {showInfo && (
          <div className="px-5 pb-5 space-y-4 border-t border-border">
            <p className="text-xs text-muted-foreground pt-3">
              File harus berformat <strong>CATATAN KEUANGAN</strong> dengan sheet bernama{' '}
              <code className="text-xs bg-muted px-1 rounded">⬇️ PEMASUKAN</code> (atau sheet pertama).
              Header baris <strong>NAMA PASIEN</strong> dan <strong>PEMBELIAN</strong> wajib ada.
            </p>
            <p className="text-xs text-muted-foreground">
              Hanya baris dengan kolom <strong>PEMBELIAN</strong> berikut yang akan diimport:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">PEMBELIAN</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Nama Paket</th>
                    <th className="text-center py-2 pr-4 text-muted-foreground font-medium">Sesi</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Jenis</th>
                  </tr>
                </thead>
                <tbody>
                  {PKG_TYPES.map((p) => (
                    <tr key={p.pembelian} className="border-b border-border/50">
                      <td className="py-1.5 pr-4 font-mono text-foreground/80">{p.pembelian}</td>
                      <td className="py-1.5 pr-4 text-foreground/80">{p.name}</td>
                      <td className="py-1.5 pr-4 text-center text-foreground/80">{p.sesi}</td>
                      <td className="py-1.5 text-center">
                        {p.jenis !== '—'
                          ? <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{p.jenis}</span>
                          : <span className="text-muted-foreground/50">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Baris duplikat (pasien + nama paket sama) otomatis dilewati. Nama pasien dicocokkan
              dengan database menggunakan normalisasi teks (case-insensitive, spasi ganda diabaikan).
            </p>
          </div>
        )}
      </div>

      {/* Import form */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-5">

        {/* Branch selector */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Cabang</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={uploading}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          >
            <option value="">— Pilih cabang —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* File picker */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">File Excel</label>
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:bg-muted transition-colors text-sm text-muted-foreground disabled:opacity-60"
          >
            <FileUp size={14} />
            {file ? file.name : 'Pilih file Excel (CATATAN KEUANGAN)...'}
          </button>
          {file && (
            <p className="text-xs text-muted-foreground mt-1">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>

        {/* Error */}
        {importError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {importError}
          </div>
        )}

        {/* Progress */}
        {(uploading || progress) && (
          <div className="space-y-3">
            {progress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{PHASE_LABEL[progress.phase]}</span>
                  {progress.phase === 'importing' && progress.total > 0 && (
                    <span>{pct}%</span>
                  )}
                </div>
                <p className="text-xs text-foreground/70">{progress.message}</p>
                {progress.phase === 'importing' && progress.total > 0 && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {progress.phase === 'importing' && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-[#34C759]">✓ {progress.imported} berhasil</span>
                    <span className="text-muted-foreground">↷ {progress.skipped} dilewati</span>
                    {progress.notFound > 0 && (
                      <span className="text-[#FFB35C]">? {progress.notFound} pasien tidak ditemukan</span>
                    )}
                    {progress.errors > 0 && (
                      <span className="text-destructive">✕ {progress.errors} error</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {uploading && !progress && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" />
                Menghubungi server...
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleImport}
          disabled={!canImport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {uploading
            ? <Loader2 size={14} className="animate-spin" />
            : <Package size={14} />}
          {uploading ? 'Mengimpor...' : 'Upload & Import Paket'}
        </button>

        {/* Result */}
        {result && (
          <div className="space-y-3 pt-2 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Hasil Import — sheet &quot;{result.sheetUsed}&quot;
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20">
                <CheckCircle2 size={14} className="text-[#34C759] shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Berhasil</p>
                  <p className="text-sm font-bold text-[#34C759]">{result.imported}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
                <Package size={14} className="text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Sudah Ada</p>
                  <p className="text-sm font-bold text-foreground">{result.skipped}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#FFB35C]/10 border border-[#FFB35C]/20">
                <UserX size={14} className="text-[#FFB35C] shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Pasien N/A</p>
                  <p className="text-sm font-bold text-[#FFB35C]">{result.notFound}</p>
                </div>
              </div>
              {result.errors > 0 && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20">
                  <XCircle size={14} className="text-destructive shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Error</p>
                    <p className="text-sm font-bold text-destructive">{result.errors}</p>
                  </div>
                </div>
              )}
            </div>
            {result.notFound > 0 && (
              <p className="text-xs text-[#FFB35C]/80 bg-[#FFB35C]/10 px-3 py-2 rounded-xl">
                {result.notFound} baris dilewati karena nama pasien tidak cocok dengan data di database.
                Pastikan data pasien sudah diimport terlebih dahulu.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Link back to patient import */}
      <p className="text-xs text-muted-foreground">
        Belum import data pasien?{' '}
        <Link href="/director/import" className="text-primary hover:underline">
          Import data pasien terlebih dahulu →
        </Link>
      </p>
    </div>
  )
}
