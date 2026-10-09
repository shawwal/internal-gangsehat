'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  CheckCircle2, Copy, ExternalLink, FileText, Loader2, MessageCircle, Monitor, RefreshCw, X, XCircle,
} from 'lucide-react'
import {
  cancelPaymentLink, checkPaymentLinkStatus, getPaymentLinkReceiptUrl, markPaymentLinkSent,
} from '@/app/actions/paymentLinks'
import { channelLabel } from '@/lib/doku/channels'
import { formatCurrency, formatWaNumber } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { MethodBadge, PaymentLinkStatusBadge } from './PaymentLinkStatusBadge'
import { effectiveStatus, type PaymentLinkView } from './types'
import { ModalPortal } from './ModalPortal'

const POLL_MS = 5000

const jkt = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

function useCountdown(expiresAt: string, active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  const ms = Math.max(Date.parse(expiresAt) - now, 0)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return h > 0 ? `${h}j ${m}m` : `${m}:${String(s).padStart(2, '0')}`
}

export function waMessage(link: PaymentLinkView) {
  return [
    `Halo ${link.customer_name}, berikut link pembayaran Fisioterapi Gang Sehat:`,
    '',
    `${link.category}${link.description ? ` — ${link.description}` : ''}`,
    `Nominal: ${formatCurrency(link.amount)}`,
    `Metode: ${link.method === 'QRIS' ? 'QRIS (semua e-wallet & m-banking)' : 'Virtual Account bank'}`,
    `Bayar sebelum: ${jkt(link.expires_at)} WIB`,
    '',
    link.checkout_url ?? '',
    '',
    'Terima kasih 🙏',
  ].join('\n')
}

interface Props {
  link: PaymentLinkView
  onClose: () => void
  /** Called whenever the link changes (status, sent) so host lists can refresh. */
  onChange?: (link: PaymentLinkView) => void
}

/** Share / show / track one payment link. Polls DOKU while pending and visible. */
export function PaymentLinkPanel({ link: initial, onClose, onChange }: Props) {
  const { showToast } = useToast()
  const [link, setLink] = useState(initial)
  const [checking, setChecking] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(initial.method === 'VA')
  const status = effectiveStatus(link)
  const pending = link.status === 'pending'
  const countdown = useCountdown(link.expires_at, pending)

  const lastRef = useRef(initial)
  const update = useCallback((next: PaymentLinkView) => {
    const prev = lastRef.current
    lastRef.current = next
    setLink(next)
    if (prev.status !== 'paid' && next.status === 'paid') showToast(`Pembayaran ${formatCurrency(next.amount)} diterima`, 'success')
    // Polls return the same row most of the time — only tell the host about real changes.
    if (prev.status !== next.status || prev.has_receipt !== next.has_receipt || prev.sent_at !== next.sent_at) onChange?.(next)
  }, [onChange, showToast])

  const check = useCallback(async (manual = false) => {
    if (manual) setChecking(true)
    const res = await checkPaymentLinkStatus(link.id)
    if (manual) setChecking(false)
    if (res.data) update(res.data)
    if (manual && res.error) showToast(res.error, 'error')
  }, [link.id, update, showToast])

  // Poll while pending (also while paid until the receipt exists), and only when the tab is visible.
  const needsPoll = pending || (link.status === 'paid' && !link.has_receipt)
  useEffect(() => {
    if (!needsPoll) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') check()
    }, POLL_MS)
    return () => clearInterval(t)
  }, [needsPoll, check])

  useEffect(() => {
    if (!link.checkout_url) return
    QRCode.toDataURL(link.checkout_url, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(null))
  }, [link.checkout_url])

  async function markSent(via: 'whatsapp' | 'copy' | 'screen') {
    await markPaymentLinkSent(link.id, via)
    update({ ...lastRef.current, sent_at: new Date().toISOString(), sent_via: via })
  }

  function openOnScreen() {
    if (!link.checkout_url) return
    window.open(link.checkout_url, '_blank', 'noopener')
    markSent('screen')
  }

  function sendWhatsApp() {
    const phone = link.customer_phone ? formatWaNumber(link.customer_phone) : ''
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage(link))}`, '_blank', 'noopener')
    markSent('whatsapp')
  }

  async function copyLink() {
    if (!link.checkout_url) return
    try {
      await navigator.clipboard.writeText(link.checkout_url)
      showToast('Link disalin', 'success')
      markSent('copy')
    } catch {
      showToast('Gagal menyalin link', 'error')
    }
  }

  async function openReceipt() {
    const win = window.open('', '_blank')
    const url = await getPaymentLinkReceiptUrl(link.id)
    if (url && win) win.location.href = url
    else { win?.close(); showToast('Kwitansi belum tersedia', 'error') }
  }

  async function cancel() {
    if (!confirm('Batalkan link ini? Pembayaran yang tetap masuk akan tetap dicatat.')) return
    const { error } = await cancelPaymentLink(link.id)
    if (error) showToast(error, 'error')
    else update({ ...lastRef.current, status: 'cancelled' })
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-3 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{link.customer_name}</p>
              {link.environment === 'development' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFB35C]/20 text-[#FFB35C] font-bold tracking-wide">SANDBOX</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">{link.invoice_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain min-h-0 flex-1">
          <div className="text-center space-y-1.5">
            <p className="text-3xl font-bold text-foreground">{formatCurrency(link.amount)}</p>
            <p className="text-xs text-muted-foreground">{link.category}{link.description ? ` · ${link.description}` : ''}</p>
            <div className="flex items-center justify-center gap-1.5">
              <MethodBadge method={link.method} />
              <PaymentLinkStatusBadge link={link} />
              {status === 'pending' && <span className="text-[11px] text-muted-foreground font-mono">sisa {countdown}</span>}
            </div>
          </div>

          {link.status === 'paid' ? (
            <div className="rounded-2xl bg-[#34C759]/10 border border-[#34C759]/30 p-4 text-center space-y-2">
              <CheckCircle2 size={36} className="text-[#34C759] mx-auto" />
              <p className="text-sm font-semibold text-[#34C759]">Pembayaran diterima</p>
              <p className="text-xs text-muted-foreground">
                {channelLabel(link.payment_channel)}{link.paid_at ? ` · ${jkt(link.paid_at)} WIB` : ''}
              </p>
              {link.doku_reference && <p className="text-[11px] text-muted-foreground font-mono">Ref {link.doku_reference}</p>}
              <button
                onClick={openReceipt}
                disabled={!link.has_receipt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#34C759] text-white text-xs font-semibold hover:bg-[#34C759]/90 disabled:opacity-50 cursor-pointer"
              >
                {link.has_receipt ? <FileText size={13} /> : <Loader2 size={13} className="animate-spin" />}
                {link.has_receipt ? 'Lihat kwitansi' : 'Membuat kwitansi…'}
              </button>
            </div>
          ) : status === 'pending' ? (
            <>
              <button
                onClick={openOnScreen}
                disabled={!link.checkout_url}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
              >
                <Monitor size={16} />
                {link.method === 'QRIS' ? 'Tampilkan QRIS di layar' : 'Buka halaman pembayaran'}
                <ExternalLink size={13} className="opacity-70" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={sendWhatsApp} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#34C759]/40 text-[#34C759] text-xs font-semibold hover:bg-[#34C759]/10 cursor-pointer">
                  <MessageCircle size={14} /> Kirim WhatsApp
                </button>
                <button onClick={copyLink} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-white/5 cursor-pointer">
                  <Copy size={14} /> Salin link
                </button>
              </div>

              {qr && (
                showQr ? (
                  <div className="rounded-2xl bg-white p-3 flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="QR link pembayaran" className="w-48 h-48" />
                    <p className="text-[10px] text-neutral-500 text-center">
                      Scan dengan kamera HP untuk membuka halaman pembayaran
                      {link.method === 'QRIS' ? ' (bukan kode QRIS)' : ''}
                    </p>
                  </div>
                ) : (
                  <button onClick={() => setShowQr(true)} className="w-full text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
                    Tampilkan QR link (agar pasien membuka di HP sendiri)
                  </button>
                )
              )}

              <p className="text-[11px] text-muted-foreground text-center">
                {link.sent_at ? `Terakhir dibagikan via ${link.sent_via} · ${jkt(link.sent_at)}` : 'Belum dibagikan'}
                {' · '}Status diperbarui otomatis
              </p>
            </>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center space-y-1">
              <XCircle size={28} className="text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                {status === 'cancelled' ? 'Link dibatalkan.' : 'Link sudah kedaluwarsa.'} Buat link baru bila pasien masih ingin membayar online.
              </p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-muted-foreground">Dibuat</dt><dd className="text-right">{jkt(link.created_at)}{link.created_by_name ? ` · ${link.created_by_name}` : ''}</dd>
            <dt className="text-muted-foreground">Berlaku s/d</dt><dd className="text-right">{jkt(link.expires_at)}</dd>
            {link.branch_name && (<><dt className="text-muted-foreground">Cabang</dt><dd className="text-right">{link.branch_name}</dd></>)}
          </dl>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          {pending && (
            <button onClick={cancel} className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer">
              Batalkan
            </button>
          )}
          <button
            onClick={() => check(true)}
            disabled={checking}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 cursor-pointer"
          >
            {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Cek status
          </button>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 cursor-pointer">
            Tutup
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}
