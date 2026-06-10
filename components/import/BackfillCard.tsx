'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { backfillPhoneHashes } from '@/app/actions/patients'

export function BackfillCard() {
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

  return (
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
  )
}
