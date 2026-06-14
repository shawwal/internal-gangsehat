'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { backfillPhoneHashes, backfillNameNormalized } from '@/app/actions/patients'

type Result = { updated: number; errors: number }

function BackfillRow({
  title,
  description,
  onRun,
}: {
  title: string
  description: React.ReactNode
  onRun: () => Promise<Result>
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<Result | null>(null)

  async function handle() {
    setRunning(true)
    setResult(null)
    try { setResult(await onRun()) } finally { setRunning(false) }
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {result && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 size={14} className="text-chart-4 shrink-0" />
          <span className="text-foreground">
            <span className="font-semibold text-chart-4">{result.updated}</span> pasien diperbarui
            {result.errors > 0 && (
              <span className="text-destructive ml-2">{result.errors} error</span>
            )}
          </span>
        </div>
      )}
      <button
        onClick={handle}
        disabled={running}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
      >
        <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
        {running ? 'Memproses...' : 'Jalankan Backfill'}
      </button>
    </div>
  )
}

export function BackfillCard() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
      <BackfillRow
        title="Sinkronkan Nama Ternormalisasi"
        description={<>Jalankan sekali setelah migrasi untuk mengisi kolom <code className="text-xs bg-muted px-1 rounded">name_normalized</code> pada pasien yang sudah ada, sehingga pencarian cepat berfungsi.</>}
        onRun={backfillNameNormalized}
      />
      <div className="border-t border-border/30" />
      <BackfillRow
        title="Sinkronkan Hash Telepon"
        description={<>Jalankan sekali setelah migrasi untuk mengisi kolom <code className="text-xs bg-muted px-1 rounded">phone_hash</code> pada pasien yang sudah ada, sehingga deteksi duplikat di portal gangsehat.com berfungsi.</>}
        onRun={backfillPhoneHashes}
      />
    </div>
  )
}
