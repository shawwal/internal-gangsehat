'use client'

import { useEffect, useState } from 'react'
import { Hourglass, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { fetchVisitPendingPayments, reviewPendingPayment, type PendingPaymentRow } from '@/app/actions/transactions'
import { PaymentProofLink } from '@/components/payments/PaymentProofField'
import { canConfirmPayment } from '@/lib/finance/paymentConfirm'
import type { DailyVisit } from './types'

interface Props {
  visit: DailyVisit
  userRole: string | null
  onClose: () => void
  /** a payment was confirmed or rejected — reload the card */
  onReviewed: () => void
}

const formatRp = (n: number | null) => `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`
const formatDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

// "Menunggu Konfirmasi" on a Jadwal Harian card: the payments that would settle
// the bill but haven't been checked yet. Everyone sees them (read-only); only
// finance / manager / director confirm or reject — admins record, not approve.
export function PendingPaymentDialog({ visit, userRole, onClose, onReviewed }: Props) {
  const [rows, setRows]         = useState<PendingPaymentRow[] | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason]     = useState('')
  const canReview = canConfirmPayment(userRole)

  useEffect(() => {
    let cancelled = false
    fetchVisitPendingPayments(visit.id).then((res) => {
      if (cancelled) return
      setRows(res.rows)
      setError(res.error)
    })
    return () => { cancelled = true }
  }, [visit.id])

  async function review(id: string, decision: 'confirm' | 'reject') {
    if (busyId) return
    setBusyId(id)
    setError(null)
    const res = await reviewPendingPayment(id, decision, decision === 'reject' ? reason : undefined)
    setBusyId(null)
    if (res.error) { setError(res.error); return }
    setRejectId(null)
    setReason('')
    const next = (rows ?? []).filter((r) => r.id !== id)
    setRows(next)
    onReviewed()
    if (next.length === 0) onClose()
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Hourglass size={16} className="text-[#FFB35C] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Menunggu Konfirmasi</p>
            <p className="text-xs text-muted-foreground truncate">
              {visit.patient_name}{visit.package_id && visit.package_name ? ` · ${visit.package_name}` : ''}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pembayaran ini sudah dicatat tetapi belum dicek. Status baru <span className="font-semibold text-foreground">Lunas</span> setelah
            Finance, Manager atau Director memastikan dananya masuk.
          </p>

          {rows === null ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Tidak ada pembayaran yang menunggu konfirmasi.</p>
          ) : rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{formatRp(r.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.payment_status ?? '—'} · {r.category}{r.harga ? ` · harga ${formatRp(r.harga)}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FFB35C]/15 text-[#FFB35C] border border-[#FFB35C]/25">
                  Pending
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                <span>{formatDate(r.transaction_date)}</span>
                <span>·</span>
                <span>{r.payment_method ?? '—'}</span>
                <PaymentProofLink path={r.receipt_url} />
                {r.recorded_by_name && <><span>·</span><span>dicatat {r.recorded_by_name}</span></>}
              </div>

              {canReview && (rejectId === r.id ? (
                <div className="space-y-2 pt-1">
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Alasan penolakan"
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setRejectId(null); setReason('') }}
                      className="flex-1 px-3 py-1.5 rounded-xl text-xs font-medium border border-border hover:bg-muted transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={!reason.trim() || busyId === r.id}
                      onClick={() => review(r.id, 'reject')}
                      className="flex-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
                    >
                      {busyId === r.id ? 'Menyimpan...' : 'Tolak Pembayaran'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => { setRejectId(r.id); setReason('') }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={13} /> Tolak
                  </button>
                  <button
                    type="button"
                    disabled={!!busyId}
                    onClick={() => review(r.id, 'confirm')}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#34C759] text-white hover:bg-[#34C759]/90 transition-colors disabled:opacity-50"
                  >
                    {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Konfirmasi
                  </button>
                </div>
              ))}
            </div>
          ))}

          {!canReview && rows && rows.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Konfirmasi dilakukan oleh Finance, Manager atau Director — hubungi mereka bila pasien menanyakan status pembayaran.
            </p>
          )}

          {error && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
