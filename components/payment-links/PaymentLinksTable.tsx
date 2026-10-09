'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { listPaymentLinks } from '@/app/actions/paymentLinks'
import { channelLabel } from '@/lib/doku/channels'
import { formatCurrency } from '@/lib/utils'
import { MethodBadge, PaymentLinkStatusBadge } from './PaymentLinkStatusBadge'
import { PaymentLinkPanel } from './PaymentLinkPanel'
import type { PaymentLinkFilters, PaymentLinkView } from './types'

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'paid', label: 'Lunas' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

const jkt = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

interface Props {
  /** Fixed filters from the host (e.g. a patient's page). */
  scope?: Pick<PaymentLinkFilters, 'patientId' | 'visitId'>
  showFilters?: boolean
  showBranch?: boolean
  /** Bump to force a reload (e.g. after creating a link). */
  reloadKey?: number
}

export function PaymentLinksTable({ scope, showFilters = true, showBranch = false, reloadKey = 0 }: Props) {
  const [filters, setFilters] = useState<PaymentLinkFilters>({ status: '', method: '', search: '' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<PaymentLinkView[]>([])
  const [count, setCount] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<PaymentLinkView | null>(null)

  const [manualReload, setManualReload] = useState(0)
  const load = () => setManualReload((n) => n + 1)
  const patientId = scope?.patientId
  const visitId = scope?.visitId

  // Rows stay visible while a reload is in flight; the spinner is first-load only.
  useEffect(() => {
    let cancelled = false
    listPaymentLinks({ ...filters, patientId, visitId }, page).then((res) => {
      if (cancelled) return
      setRows(res.rows)
      setCount(res.count)
      setPageSize(res.pageSize)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [filters, patientId, visitId, page, reloadKey, manualReload])

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters((f) => ({ ...f, search })) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const pages = Math.max(Math.ceil(count / pageSize), 1)

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / no. invoice"
              className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, status: e.target.value as PaymentLinkFilters['status'] })) }}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={filters.method}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, method: e.target.value as PaymentLinkFilters['method'] })) }}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer"
          >
            <option value="">QRIS & VA</option>
            <option value="QRIS">QRIS</option>
            <option value="VA">VA</option>
          </select>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Dibuat</th>
                <th className="text-left px-4 py-3 font-medium">Pembayar</th>
                <th className="text-left px-4 py-3 font-medium">Kategori</th>
                {showBranch && <th className="text-left px-4 py-3 font-medium">Cabang</th>}
                <th className="text-center px-4 py-3 font-medium">Metode</th>
                <th className="text-right px-4 py-3 font-medium">Nominal</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Dibayar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 size={18} className="animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Belum ada link pembayaran</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="border-b border-white/5 hover:bg-white/5 cursor-pointer">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{jkt(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{r.customer_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{r.invoice_number}{r.environment === 'development' ? ' · sandbox' : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/90">{r.category}</td>
                  {showBranch && <td className="px-4 py-3 text-xs text-muted-foreground">{r.branch_name ?? '—'}</td>}
                  <td className="px-4 py-3 text-center"><MethodBadge method={r.method} /></td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-center"><PaymentLinkStatusBadge link={r} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {r.paid_at ? `${jkt(r.paid_at)} · ${channelLabel(r.payment_channel)}` : r.sent_via ? `dibagikan (${r.sent_via})` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs text-muted-foreground">
            <span>{count} link</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40 cursor-pointer"><ChevronLeft size={14} /></button>
              <span>{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40 cursor-pointer"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <PaymentLinkPanel
          link={open}
          onClose={() => { setOpen(null); load() }}
          onChange={(l) => setRows((rs) => rs.map((x) => (x.id === l.id ? l : x)))}
        />
      )}
    </div>
  )
}
