'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getPfotmMetricDetail } from '@/app/actions/pfotm'
import { MetricDetailTable } from '@/components/metrics/MetricDetailModal'
import type { MetricDetail } from '@/lib/metrics/achievement'

type Loaded = { ok: true; data: MetricDetail } | { ok: false; error: string }

/** Opened in a new tab from the PFOTM board dialog: the patients behind one metric of one participant. */
function Rincian() {
  const params = useSearchParams()
  const entry = params.get('entry') ?? ''
  const metric = params.get('metric') ?? ''
  const name = params.get('name') ?? ''
  const label = params.get('label') ?? metric
  const [state, setState] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    getPfotmMetricDetail(entry, metric).then((res) => { if (!cancelled) setState(res) })
    return () => { cancelled = true }
  }, [entry, metric])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{label}{name && ` — ${name}`}</h1>
        <p className="text-sm text-muted-foreground">Pasien &amp; tanggal yang dihitung otomatis pada periode PFOTM ini</p>
      </div>
      <div className="glass-card p-4 md:p-5 overflow-x-auto">
        {!state ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={18} className="animate-spin" /></div>
        ) : !state.ok ? (
          <p className="text-sm text-destructive py-6 text-center">{state.error}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              Total otomatis <b className="text-foreground">{state.data.auto}</b>
              {state.data.override !== null && <> · dikoreksi manual menjadi <b className="text-foreground">{state.data.override}</b></>}
            </p>
            {state.data.rows.length === 0
              ? <p className="text-sm text-muted-foreground py-6 text-center">Tidak ada data otomatis untuk angka ini.</p>
              : <MetricDetailTable rows={state.data.rows} />}
          </>
        )}
      </div>
    </div>
  )
}

export default function PfotmRincianPage() {
  return <Suspense><Rincian /></Suspense>
}
