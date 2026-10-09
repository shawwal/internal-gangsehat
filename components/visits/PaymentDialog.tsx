'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronUp,
  CreditCard, Landmark, Loader2, QrCode, Stethoscope, User, X,
} from 'lucide-react'
import { createTransactionForVisit, updateTransaction, getPatientOutstanding, fetchLayananHarga } from '@/app/actions/transactions'
import type { OutstandingTransaction } from '@/app/actions/transactions'
import { updateVisit, type VisitTransaction } from '@/app/actions/jadwal'
import { fetchSportMassageLayanan, type LayananRow } from '@/app/actions/layanan'
import { SERVICE_TYPES, SERVICE_TO_CATEGORY, CATEGORY_TO_SERVICE_TYPE, getEffectivePackageServiceType } from '@/lib/serviceType'
import type { ServiceType } from '@/types'
import { SettlePaymentDialog } from '@/components/finance/SettlePaymentDialog'
import { PaymentProofField } from '@/components/payments/PaymentProofField'
import { PAYMENT_PROOF_REQUIRED_MSG, isPaymentProofRequiredOnEdit, requiresPaymentProof } from '@/lib/paymentProof'
import { createPaymentLink } from '@/app/actions/paymentLinks'
import { PaymentLinkPanel } from '@/components/payment-links/PaymentLinkPanel'
import type { PaymentLinkView } from '@/components/payment-links/types'
import { ONLINE_PAYMENT, type PaymentLinkMethod } from '@/lib/doku/channels'
import { OnlineMethodPicker } from '@/components/payment-links/OnlineMethodPicker'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PaymentVisitInfo {
  id: string
  patient_id: string
  patient_name: string
  visit_date: string
  service_type: string | null
  branch_id?: string | null
  /** set → visit is part of a package; used to normalize a mislabeled service_type */
  package_id?: string | null
  /** Sport Massage service type booked on the visit (internal_layanan id) */
  layanan_id?: string | null
  attending_staff_name?: string
}

interface Props {
  visit: PaymentVisitInfo
  /** Existing payment to edit in place, rather than adding a new one. */
  existingTransaction?: VisitTransaction | null
  onClose: () => void
  onSuccess: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAYMENT_ROLES = ['finance', 'manager', 'director']

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtShortDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Metode Bayar sentinel (lib/doku/channels.ts): selecting it sends a DOKU link instead.
const ONLINE = ONLINE_PAYMENT

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

// ── Component ──────────────────────────────────────────────────────────────────
export function PaymentDialog({ visit, existingTransaction, onClose, onSuccess }: Props) {
  const isEditing = !!existingTransaction
  const [isClosing, setIsClosing]             = useState(false)
  const [outstanding, setOutstanding]         = useState<OutstandingTransaction[]>([])
  const [showOutstanding, setShowOutstanding] = useState(false)
  const [loadingOuts, setLoadingOuts]         = useState(true)
  const [settleTarget, setSettleTarget]       = useState<OutstandingTransaction | null>(null)

  const [serviceType, setServiceType]     = useState<ServiceType>(
    () => getEffectivePackageServiceType(visit.service_type, visit.package_id) ?? 'LAINNYA',
  )
  const [harga, setHarga]                 = useState(existingTransaction?.harga != null ? String(existingTransaction.harga) : '')
  const [discount, setDiscount]           = useState(existingTransaction?.discount != null ? String(existingTransaction.discount) : '')
  const [amount, setAmount]               = useState(existingTransaction?.amount != null ? String(existingTransaction.amount) : '')
  // Jumlah Bayar follows Harga − Diskon until the admin types their own amount
  // (e.g. a DP); changing Harga or Diskon again re-syncs it. An existing payment
  // starts on its saved amount.
  const [amountManual, setAmountManual]   = useState(!!existingTransaction)
  const [paymentMethod, setPaymentMethod] = useState(existingTransaction?.payment_method ?? 'TUNAI')
  const [paymentStatus, setPaymentStatus] = useState(existingTransaction?.payment_status ?? 'LUNAS')
  const [penjamin, setPenjamin]           = useState(existingTransaction?.penjamin ?? '')
  const [description, setDescription]     = useState(existingTransaction?.description ?? '')
  const [txDate, setTxDate]               = useState(existingTransaction?.transaction_date ?? visit.visit_date)
  const [proofPath, setProofPath]         = useState<string | null>(existingTransaction?.receipt_url ?? null)
  const [proofUploading, setProofUploading] = useState(false)

  // Sport Massage has several priced service types per branch — pick one
  const [smLayanan, setSmLayanan]     = useState<LayananRow[]>([])
  const [smLayananId, setSmLayananId] = useState<string | null>(visit.layanan_id ?? null)
  const isSportMassage = serviceType === 'SPORT MASSAGE'
  const smSelected = smLayanan.find((l) => l.id === smLayananId) ?? null

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [onlineMethod, setOnlineMethod] = useState<PaymentLinkMethod>('QRIS')
  const [onlineLink, setOnlineLink]     = useState<PaymentLinkView | null>(null)
  const isOnline = paymentMethod === ONLINE
  const [success, setSuccess]       = useState(false)
  const [shakeBtn, setShakeBtn]     = useState(false)

  const proofRequired = isEditing
    ? isPaymentProofRequiredOnEdit({ method: existingTransaction.payment_method, proofPath: existingTransaction.receipt_url }, paymentMethod)
    : requiresPaymentProof(paymentMethod)

  const h = Number(harga) || 0
  const d = Number(discount) || 0
  const amountValue = amountManual ? amount : (h > 0 ? String(Math.max(h - d, 0)) : '')
  const a = Number(amountValue) || 0

  // Auto-suggest payment status based on amounts
  useEffect(() => {
    if (h > 0 && a >= h - d) setPaymentStatus('LUNAS')
    else if (a > 0)           setPaymentStatus('DP')
  }, [h, d, a])

  function refreshOutstanding() {
    getPatientOutstanding(visit.patient_id).then((data) => {
      setOutstanding(data)
      setLoadingOuts(false)
    })
  }

  useEffect(refreshOutstanding, [visit.patient_id])

  useEffect(() => {
    // Editing an existing transaction already has its real harga — never
    // silently overwrite it with a price-list guess.
    if (isEditing) return
    // Package categories (PAKET KLINIK / PAKET VISIT) can have several price
    // tiers per branch (different package variants/session counts); this
    // lookup has no way to know which one is intended, so auto-filling here
    // would silently substitute the wrong package's price. Leave it for staff
    // to enter manually instead.
    const category = SERVICE_TO_CATEGORY[serviceType]
    if (category === 'PAKET KLINIK' || category === 'PAKET VISIT') return
    // Sport Massage price comes from the selected service type (effect below)
    if (serviceType === 'SPORT MASSAGE') return
    fetchLayananHarga(serviceType, visit.branch_id).then((price) => {
      if (price != null) setHarga(String(price))
    })
  }, [serviceType, visit.branch_id, isEditing])

  useEffect(() => {
    if (!isSportMassage || !visit.branch_id) return
    let cancelled = false
    fetchSportMassageLayanan(visit.branch_id).then((rows) => {
      if (cancelled) return
      setSmLayanan(rows)
      // Booked type may have been deactivated since — fall back to the only
      // option when there's exactly one, otherwise make staff choose.
      const booked = rows.find((r) => r.id === visit.layanan_id)
      const initial = booked ?? (rows.length === 1 ? rows[0] : null)
      setSmLayananId(initial?.id ?? null)
      if (!isEditing && initial) setHarga(String(initial.harga))
    })
    return () => { cancelled = true }
  }, [isSportMassage, visit.branch_id, visit.layanan_id, isEditing])

  function handleSelectSmLayanan(id: string) {
    setSmLayananId(id)
    const row = smLayanan.find((l) => l.id === id)
    if (row) { setHarga(String(row.harga)); setAmountManual(false) }
  }

  function handleClose() {
    if (submitting) return
    setIsClosing(true)
    setTimeout(onClose, 220)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || proofUploading) return
    if (isSportMassage && smLayanan.length > 0 && !smSelected) {
      setError('Pilih jenis layanan Sport Massage.')
      return
    }
    if (proofRequired && !proofPath) {
      setError(PAYMENT_PROOF_REQUIRED_MSG)
      return
    }
    if (isOnline) { await handleCreateOnlineLink(); return }
    setSubmitting(true)
    setError(null)
    const payload = {
      harga: h,
      discount: d,
      amount: a,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      penjamin:    penjamin    || null,
      // Record which Sport Massage type was billed when staff left no note
      description: description || (isSportMassage && smSelected ? smSelected.nama : null),
      transaction_date: txDate,
      category: SERVICE_TO_CATEGORY[serviceType],
      // Cash/EDC payments don't keep a stale proof from a previous transfer edit
      receipt_url: requiresPaymentProof(paymentMethod) ? proofPath : null,
    }
    const result = isEditing
      ? await updateTransaction(existingTransaction.id, payload)
      : await createTransactionForVisit(visit.id, payload)
    if (result.error) {
      setError(result.error)
      setShakeBtn(true)
      setTimeout(() => setShakeBtn(false), 400)
      setSubmitting(false)
    } else {
      await syncVisitServiceType()
      setSuccess(true)
      setTimeout(() => { onSuccess(); onClose() }, 1400)
    }
  }

  // Keep the visit's own service_type in sync with whatever Layanan/Kategori
  // ended up being saved here, so the jadwal-harian grid card (which reads
  // service_type directly) reflects the same correction the user just made.
  async function syncVisitServiceType() {
    const nextLayananId = isSportMassage ? (smSelected?.id ?? visit.layanan_id ?? null) : null
    const visitPatch: { service_type?: string; layanan_id?: string | null } = {}
    if (serviceType !== visit.service_type) visitPatch.service_type = serviceType
    if (nextLayananId !== (visit.layanan_id ?? null)) visitPatch.layanan_id = nextLayananId
    if (Object.keys(visitPatch).length > 0) await updateVisit(visit.id, visitPatch)
  }

  // "Pembayaran Online": create a DOKU link from this form's values, then show
  // the share/QR panel. The transaction is recorded when DOKU confirms payment.
  async function handleCreateOnlineLink() {
    if (a < 1000) { setError('Nominal minimal Rp1.000 untuk pembayaran online'); return }
    setSubmitting(true)
    setError(null)
    const res = await createPaymentLink({
      method: onlineMethod,
      amount: a,
      harga: h || null,
      discount: d || null,
      category: SERVICE_TO_CATEGORY[serviceType],
      description: description || (isSportMassage && smSelected ? smSelected.nama : null),
      visitId: visit.id,
      patientId: visit.patient_id,
    })
    setSubmitting(false)
    if (res.error || !res.data) {
      setError(res.error ?? 'Gagal membuat link pembayaran')
      setShakeBtn(true)
      setTimeout(() => setShakeBtn(false), 400)
      return
    }
    await syncVisitServiceType()
    setOnlineLink(res.data)
  }

  const category = SERVICE_TO_CATEGORY[serviceType]

  return (
    <>
      <style>{`
        @keyframes payBdIn    { from{opacity:0}                                          to{opacity:1} }
        @keyframes payBdOut   { from{opacity:1}                                          to{opacity:0} }
        @keyframes payPanelIn { from{opacity:0;transform:translateX(40px)}               to{opacity:1;transform:translateX(0)} }
        @keyframes payPanelOut{ from{opacity:1;transform:translateX(0)}                  to{opacity:0;transform:translateX(40px)} }
        @keyframes shakeX     { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        @keyframes slideDown  { from{opacity:0;transform:translateY(-8px)}               to{opacity:1;transform:translateY(0)} }
        @keyframes successPop { 0%{transform:scale(.8);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          style={{ animation: `${isClosing ? 'payBdOut' : 'payBdIn'} 220ms ease forwards` }}
          onClick={handleClose}
        />

        {/* Panel — right sheet on all sizes */}
        <div
          className="absolute right-0 top-0 bottom-0 w-full sm:max-w-[480px] flex flex-col bg-background border-l border-white/10 shadow-2xl overflow-hidden"
          style={{ animation: `${isClosing ? 'payPanelOut 220ms ease forwards' : 'payPanelIn 300ms cubic-bezier(0.34,1.56,0.64,1) forwards'}` }}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0 bg-white/3 backdrop-blur-sm">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{isEditing ? 'Edit Pembayaran' : 'Catat Pembayaran'}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(visit.visit_date)}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Visit summary */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={15} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{visit.patient_name}</p>
                  <p className="text-xs text-muted-foreground">Pasien</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-primary/8 border border-primary/10 px-3 py-2.5">
                  <label className="block text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Layanan</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as ServiceType)}
                    className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer -ml-0.5"
                  >
                    {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5">
                  <label className="block text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const matched = CATEGORY_TO_SERVICE_TYPE[e.target.value]
                      if (matched) setServiceType(matched)
                    }}
                    className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer -ml-0.5"
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={SERVICE_TO_CATEGORY[s]}>{SERVICE_TO_CATEGORY[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isSportMassage && smLayanan.length > 0 && (
                <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5">
                  <label className="block text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Jenis Sport Massage</label>
                  <select
                    value={smLayananId ?? ''}
                    onChange={(e) => handleSelectSmLayanan(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer -ml-0.5"
                  >
                    {!smSelected && <option value="" disabled>Pilih jenis layanan...</option>}
                    {smLayanan.map((l) => (
                      <option key={l.id} value={l.id}>{l.nama} — {fmt(Number(l.harga))}</option>
                    ))}
                  </select>
                </div>
              )}

              {visit.attending_staff_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Stethoscope size={12} className="shrink-0" />
                  <span className="text-xs">{visit.attending_staff_name}</span>
                </div>
              )}
            </div>

            {/* Outstanding alert */}
            {!loadingOuts && outstanding.length > 0 && (
              <div
                className="rounded-2xl border border-[#FFB35C]/30 bg-[#FFB35C]/8 overflow-hidden"
                style={{ animation: 'slideDown 250ms ease forwards' }}
              >
                <div className="w-full flex items-center gap-2.5 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShowOutstanding((v) => !v)}
                    className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
                  >
                    <AlertTriangle size={14} className="text-[#FFB35C] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#FFB35C]">Ada Tunggakan Pasien</p>
                      <p className="text-[11px] text-muted-foreground">
                        {outstanding.length} transaksi belum lunas ·{' '}
                        {fmt(outstanding.reduce((s, t) => s + t.outstanding, 0))} total sisa
                      </p>
                    </div>
                  </button>
                  {outstanding.length === 1 && outstanding[0].order_id && (
                    <button
                      type="button"
                      onClick={() => setSettleTarget(outstanding[0])}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FFB35C]/15 text-[#FFB35C] hover:bg-[#FFB35C]/25 transition-colors cursor-pointer shrink-0"
                    >
                      Bayar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowOutstanding((v) => !v)}
                    className="shrink-0 cursor-pointer"
                  >
                    {showOutstanding
                      ? <ChevronUp size={14} className="text-muted-foreground" />
                      : <ChevronDown size={14} className="text-muted-foreground" />
                    }
                  </button>
                </div>

                {showOutstanding && (
                  <div className="border-t border-[#FFB35C]/15 divide-y divide-[#FFB35C]/10">
                    {outstanding.map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{t.category}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[10px] text-muted-foreground">{fmtShortDate(t.transaction_date)}</p>
                            {t.payment_status && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[#FFB35C]/15 text-[#FFB35C]">
                                {t.payment_status}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-xs font-semibold text-[#FFB35C]">{fmt(t.outstanding)}</p>
                          {t.order_id && (
                            <button
                              type="button"
                              onClick={() => setSettleTarget(t)}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#FFB35C]/15 text-[#FFB35C] hover:bg-[#FFB35C]/25 transition-colors cursor-pointer"
                            >
                              Bayar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payment form */}
            <form id="pay-form" onSubmit={handleSubmit} className="space-y-3">

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1"><Calendar size={11} />Tanggal Transaksi</span>
                </label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Harga + Diskon */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Harga (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={harga}
                    onChange={(e) => { setHarga(e.target.value); setAmountManual(false) }}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Diskon (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => { setDiscount(e.target.value); setAmountManual(false) }}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Jumlah Bayar */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Jumlah Bayar (Rp)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={amountValue}
                  onChange={(e) => { setAmount(e.target.value); setAmountManual(true) }}
                  placeholder="0"
                  className={inputCls}
                />
              </div>

              {/* Metode + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Metode Bayar</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    <option value="TUNAI">TUNAI</option>
                    <option value="TRANSFER BCA">TRANSFER BCA</option>
                    <option value="EDC BCA">EDC BCA</option>
                    <option value="TRANSFER BANK KALBAR">TRANSFER BANK KALBAR</option>
                    {!isEditing && <option value={ONLINE}>PEMBAYARAN ONLINE</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Status Bayar</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    // Online: LUNAS / DP is derived from the amount when DOKU confirms payment.
                    disabled={isOnline}
                    className={inputCls + ' cursor-pointer disabled:opacity-50'}
                  >
                    <option value="LUNAS">LUNAS</option>
                    <option value="DP">DP</option>
                    <option value="PELUNASAN">PELUNASAN</option>
                  </select>
                </div>
              </div>

              {isOnline && <OnlineMethodPicker value={onlineMethod} onChange={setOnlineMethod} />}

              <PaymentProofField
                method={paymentMethod}
                value={proofPath}
                onChange={setProofPath}
                onUploadingChange={setProofUploading}
                required={proofRequired}
              />

              {/* Penjamin */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Penjamin <span className="text-muted-foreground font-normal">(opsional)</span>
                </label>
                <input
                  value={penjamin}
                  onChange={(e) => setPenjamin(e.target.value)}
                  placeholder="Nama penjamin jika ada"
                  className={inputCls}
                />
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Keterangan <span className="text-muted-foreground font-normal">(opsional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Catatan tambahan..."
                  className={inputCls + ' resize-none'}
                />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-white/10 shrink-0 bg-background/80 backdrop-blur-sm">
            {error && (
              <div className="flex items-center gap-1.5 mb-3 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
                <AlertTriangle size={13} className="text-destructive shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {success ? (
              <div
                className="flex items-center justify-center gap-2 py-3"
                style={{ animation: 'successPop 400ms cubic-bezier(0.34,1.56,0.64,1) forwards' }}
              >
                <CheckCircle2 size={20} className="text-[#34C759]" />
                <span className="text-sm font-semibold text-[#34C759]">{isEditing ? 'Pembayaran berhasil diperbarui!' : 'Pembayaran berhasil dicatat!'}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="pay-form"
                  disabled={submitting || proofUploading}
                  style={{ animation: shakeBtn ? 'shakeX 300ms ease forwards' : undefined }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-70 transition-colors cursor-pointer"
                >
                  {submitting
                    ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
                    : isOnline
                      ? <>{onlineMethod === 'QRIS' ? <QrCode size={14} /> : <Landmark size={14} />} Buat Link {onlineMethod} · {fmt(a)}</>
                      : <><CreditCard size={14} /> Simpan Pembayaran</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {onlineLink && (
        <PaymentLinkPanel
          link={onlineLink}
          onClose={() => setOnlineLink(null)}
          onChange={(l) => {
            // The paid link records the transaction itself — finish like a manual save.
            if (l.status === 'paid') { setOnlineLink(null); onSuccess(); onClose() }
          }}
        />
      )}

      {settleTarget && (
        <SettlePaymentDialog
          transaction={{
            id: settleTarget.id,
            order_id: settleTarget.order_id,
            patient_name: visit.patient_name,
            category: settleTarget.category,
            harga: settleTarget.harga,
            discount: settleTarget.discount,
            amount: settleTarget.amount,
            payment_method: settleTarget.payment_method,
            visitLabel: null,
          }}
          onClose={() => {
            setSettleTarget(null)
            refreshOutstanding()
          }}
        />
      )}
    </>
  )
}
