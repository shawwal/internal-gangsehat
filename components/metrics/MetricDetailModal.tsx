'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Modal } from '@/components/payroll/Modal'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import type { MetricDetail, MetricDetailRow } from '@/lib/metrics/achievement'

type Loaded = { ok: true; data: MetricDetail } | { ok: false; error: string }

interface Props {
  title: string
  subtitle?: string
  /** Server action call returning the list behind the number. */
  load: () => Promise<Loaded>
  onClose: () => void
  /** Optional "fix it there" link in the footer. */
  footerLink?: { href: string; label: string }
}

// Same badges as the finance Outstanding table (components/finance/OutstandingRow.tsx).
const STATUS_CLS: Record<string, string> = {
  LUNAS: 'bg-green-500/15 text-green-400',
  DP: 'bg-yellow-500/15 text-yellow-400',
  PELUNASAN: 'bg-primary/15 text-primary',
}
const STATUS_ORDER = ['LUNAS', 'DP', 'PELUNASAN']

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

/** "Which patients make up this number" — PFOTM input and payroll activity cells. */
export function MetricDetailModal({ title, subtitle, load, onClose, footerLink }: Props) {
  const [state, setState] = useState<Loaded | null>(null)
  const rows = state?.ok ? state.data.rows : []
  // Payment columns only for sales lists (kunjungan / payroll rows carry none).
  const hasPayment = rows.some((r) => r.paymentStatus !== undefined || r.paymentMethod !== undefined)
  const statusCounts = new Map<string, number>()
  if (hasPayment) for (const r of rows) {
    const k = r.paymentStatus || 'Tanpa status'
    statusCounts.set(k, (statusCounts.get(k) ?? 0) + 1)
  }
  const statusSummary = [...statusCounts].sort(([a], [b]) =>
    (STATUS_ORDER.indexOf(a) + 1 || 99) - (STATUS_ORDER.indexOf(b) + 1 || 99))

  useEffect(() => {
    let cancelled = false
    load().then((res) => { if (!cancelled) setState(res) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleExport() {
    if (!state?.ok) return Promise.resolve()
    const cols: ExportColumn<MetricDetailRow>[] = [
      { header: 'Tanggal', value: (r) => r.date },
      { header: 'Pasien', value: (r) => r.patientName },
      { header: 'Layanan / Kategori', value: (r) => r.label ?? '' },
      ...(hasPayment ? [
        { header: 'Status Pembayaran', value: (r: MetricDetailRow) => r.paymentStatus ?? '' },
        { header: 'Metode Pembayaran', value: (r: MetricDetailRow) => r.paymentMethod ?? '' },
      ] : []),
    ]
    exportToExcel(state.data.rows, cols, `rincian_${title.replace(/\W+/g, '_').toLowerCase()}`)
    return Promise.resolve()
  }

  const footer = state?.ok ? (
    <div className="flex w-full items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Total otomatis <b className="text-foreground">{state.data.auto}</b>
        {state.data.override !== null && <> · dikoreksi manual menjadi <b className="text-secondary-foreground">{state.data.override}</b></>}
        {statusSummary.length > 0 && <> · {statusSummary.map(([k, n]) => `${k} ${n}`).join(' · ')}</>}
      </p>
      <div className="flex items-center gap-2">
        {footerLink && (
          <Link href={footerLink.href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            {footerLink.label} <ExternalLink size={12} />
          </Link>
        )}
        {state.data.rows.length > 0 && <ExportButton onExport={handleExport} label="Export" />}
      </div>
    </div>
  ) : undefined

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} size="lg" footer={footer}>
      {!state ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 size={18} className="animate-spin" /></div>
      ) : !state.ok ? (
        <p className="text-sm text-destructive py-6 text-center">{state.error}</p>
      ) : state.data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Tidak ada data otomatis untuk angka ini.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="py-2 pr-2 text-left font-medium w-8">#</th>
              <th className="py-2 pr-3 text-left font-medium">Tanggal</th>
              <th className="py-2 pr-3 text-left font-medium">Pasien</th>
              <th className="py-2 pr-3 text-left font-medium">Layanan</th>
              {hasPayment && <th className="py-2 pr-3 text-left font-medium">Pembayaran</th>}
              {hasPayment && <th className="py-2 text-left font-medium">Metode</th>}
            </tr>
          </thead>
          <tbody>
            {state.data.rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="py-1.5 pr-3 font-medium text-foreground">{r.patientName}</td>
                <td className="py-1.5 pr-3 text-xs text-muted-foreground">{r.label ?? '—'}</td>
                {hasPayment && (
                  <td className="py-1.5 pr-3">
                    {r.paymentStatus ? (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[r.paymentStatus] ?? 'bg-muted text-muted-foreground'}`}>
                        {r.paymentStatus}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                )}
                {hasPayment && <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">{r.paymentMethod ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
