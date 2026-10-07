'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { fetchAdjacentRecords, type AdjacentRecord } from '@/app/actions/sessionNotes'

interface Props {
  visitId: string
  /** The page's `from` param, carried along so "back" still returns to the same list. */
  backTo: string
  /** Flush pending autosave before leaving the current form. */
  onBeforeNavigate?: () => Promise<unknown>
}

const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

// ← older / → newer medical record of the same patient (TA + session notes).
export function RecordNavButtons({ visitId, backTo, onBeforeNavigate }: Props) {
  const router = useRouter()
  const [adj, setAdj] = useState<{ prev: AdjacentRecord | null; next: AdjacentRecord | null }>({ prev: null, next: null })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAdjacentRecords(visitId).then((r) => { if (!cancelled) setAdj(r) })
    return () => { cancelled = true }
  }, [visitId])

  async function go(target: AdjacentRecord | null) {
    if (!target || busy) return
    setBusy(true)
    try {
      await onBeforeNavigate?.()
    } finally {
      router.push(`/visits/${target.visitId}/${target.route}?from=${encodeURIComponent(backTo)}`)
    }
  }

  const btn =
    'p-1.5 rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => go(adj.prev)}
        disabled={!adj.prev || busy}
        title={adj.prev ? `Rekam medis sebelumnya (${fmt(adj.prev.visitDate)})` : 'Tidak ada rekam medis sebelumnya'}
        aria-label="Rekam medis sebelumnya"
        className={btn}
      >
        <ArrowLeft size={14} />
      </button>
      <button
        type="button"
        onClick={() => go(adj.next)}
        disabled={!adj.next || busy}
        title={adj.next ? `Rekam medis berikutnya (${fmt(adj.next.visitDate)})` : 'Tidak ada rekam medis berikutnya'}
        aria-label="Rekam medis berikutnya"
        className={btn}
      >
        <ArrowRight size={14} />
      </button>
    </div>
  )
}
