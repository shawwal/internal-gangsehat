'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronUp,
  CreditCard, Loader2, Stethoscope, User, X,
} from 'lucide-react'
import { createTransactionForVisit, getPatientOutstanding, fetchLayananHarga } from '@/app/actions/transactions'
import type { OutstandingTransaction } from '@/app/actions/transactions'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PaymentVisitInfo {
  id: string
  patient_id: string
  patient_name: string
  visit_date: string
  service_type: string | null
  branch_id?: string | null
  attending_staff_name?: string
}

interface Props {
  visit: PaymentVisitInfo
  onClose: () => void
  onSuccess: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SERVICE_TO_CATEGORY: Record<string, string> = {
  'TERAPI AWAL':  'TA KLINIK',
  'SESI TERAPI':  'SESI KLINIK',
  'PAKET TERAPI': 'PAKET KLINIK',
  'TA VISIT':     'TA VISIT',
  'SESI VISIT':   'SESI VISIT',
  'PAKET VISIT':  'PAKET VISIT',
  'LAINNYA':      'LAINNYA',
}

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

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

// ── Component ──────────────────────────────────────────────────────────────────
export function PaymentDialog({ visit, onClose, onSuccess }: Props) {
  const [isClosing, setIsClosing]             = useState(false)
  const [outstanding, setOutstanding]         = useState<OutstandingTransaction[]>([])
  const [showOutstanding, setShowOutstanding] = useState(false)
  const [loadingOuts, setLoadingOuts]         = useState(true)

  const [harga, setHarga]                 = useState('')
  const [discount, setDiscount]           = useState('')
  const [amount, setAmount]               = useState('')
  const [paymentMethod, setPaymentMethod] = useState('TUNAI')
  const [paymentStatus, setPaymentStatus] = useState('LUNAS')
  const [penjamin, setPenjamin]           = useState('')
  const [description, setDescription]     = useState('')
  const [txDate, setTxDate]               = useState(visit.visit_date)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)
  const [shakeBtn, setShakeBtn]     = useState(false)
  const [sisaKey, setSisaKey]       = useState(0)

  const h = Number(harga) || 0
  const d = Number(discount) || 0
  const a = Number(amount) || 0
  const sisa = Math.max(h - a - d, 0)
  const prevSisaRef = useRef(sisa)

  // Auto-suggest payment status based on amounts
  useEffect(() => {
    if (h > 0 && a >= h - d) setPaymentStatus('LUNAS')
    else if (a > 0)           setPaymentStatus('DP')
  }, [h, d, a])

  // Animate the sisa number when it changes
  useEffect(() => {
    if (sisa !== prevSisaRef.current) {
      prevSisaRef.current = sisa
      setSisaKey((k) => k + 1)
    }
  }, [sisa])

  useEffect(() => {
    getPatientOutstanding(visit.patient_id).then((data) => {
      setOutstanding(data)
      setLoadingOuts(false)
    })
  }, [visit.patient_id])

  useEffect(() => {
    if (!visit.service_type) return
    fetchLayananHarga(visit.service_type, visit.branch_id).then((price) => {
      if (price != null) setHarga(String(price))
    })
  }, [visit.service_type, visit.branch_id])

  function handleClose() {
    if (submitting) return
    setIsClosing(true)
    setTimeout(onClose, 220)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const result = await createTransactionForVisit(visit.id, {
      harga: h,
      discount: d,
      amount: a,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      penjamin:    penjamin    || null,
      description: description || null,
      transaction_date: txDate,
    })
    if (result.error) {
      setError(result.error)
      setShakeBtn(true)
      setTimeout(() => setShakeBtn(false), 400)
      setSubmitting(false)
    } else {
      setSuccess(true)
      setTimeout(() => { onSuccess(); onClose() }, 1400)
    }
  }

  const category = SERVICE_TO_CATEGORY[visit.service_type ?? ''] ?? 'LAINNYA'

  return (
    <>
      <style>{`
        @keyframes payBdIn    { from{opacity:0}                                          to{opacity:1} }
        @keyframes payBdOut   { from{opacity:1}                                          to{opacity:0} }
        @keyframes payPanelIn { from{opacity:0;transform:translateX(40px)}               to{opacity:1;transform:translateX(0)} }
        @keyframes payPanelOut{ from{opacity:1;transform:translateX(0)}                  to{opacity:0;transform:translateX(40px)} }
        @keyframes numTick    { 0%{transform:scale(1)} 40%{transform:scale(1.16)} 100%{transform:scale(1)} }
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
                <h2 className="text-sm font-semibold text-foreground">Catat Pembayaran</h2>
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
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Layanan</p>
                  <p className="text-xs font-semibold text-foreground">{visit.service_type ?? '—'}</p>
                </div>
                <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Kategori</p>
                  <p className="text-xs font-semibold text-foreground">{category}</p>
                </div>
              </div>

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
                <button
                  type="button"
                  onClick={() => setShowOutstanding((v) => !v)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left cursor-pointer"
                >
                  <AlertTriangle size={14} className="text-[#FFB35C] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#FFB35C]">Ada Tunggakan Pasien</p>
                    <p className="text-[11px] text-muted-foreground">
                      {outstanding.length} transaksi belum lunas ·{' '}
                      {fmt(outstanding.reduce((s, t) => s + t.outstanding, 0))} total sisa
                    </p>
                  </div>
                  {showOutstanding
                    ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                    : <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                  }
                </button>

                {showOutstanding && (
                  <div className="border-t border-[#FFB35C]/15 divide-y divide-[#FFB35C]/10">
                    {outstanding.map((t) => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-xs font-medium text-foreground">{t.category}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[10px] text-muted-foreground">{fmtShortDate(t.transaction_date)}</p>
                            {t.payment_status && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[#FFB35C]/15 text-[#FFB35C]">
                                {t.payment_status}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-[#FFB35C]">{fmt(t.outstanding)}</p>
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
                    onChange={(e) => setHarga(e.target.value)}
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
                    onChange={(e) => setDiscount(e.target.value)}
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
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>

              {/* Live sisa preview */}
              <div className={`rounded-xl px-4 py-3 flex items-center justify-between transition-colors duration-200 ${
                sisa > 0
                  ? 'bg-destructive/8 border border-destructive/20'
                  : 'bg-[#34C759]/8 border border-[#34C759]/20'
              }`}>
                <span className="text-xs text-muted-foreground font-medium">Sisa Tagihan</span>
                <span
                  key={sisaKey}
                  style={{ animation: sisaKey > 0 ? 'numTick 260ms ease forwards' : undefined }}
                  className={`text-sm font-bold tabular-nums transition-colors duration-200 ${
                    sisa > 0 ? 'text-destructive' : 'text-[#34C759]'
                  }`}
                >
                  {fmt(sisa)}
                </span>
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
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Status Bayar</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    <option value="LUNAS">LUNAS</option>
                    <option value="DP">DP</option>
                    <option value="PELUNASAN">PELUNASAN</option>
                  </select>
                </div>
              </div>

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
                <span className="text-sm font-semibold text-[#34C759]">Pembayaran berhasil dicatat!</span>
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
                  disabled={submitting}
                  style={{ animation: shakeBtn ? 'shakeX 300ms ease forwards' : undefined }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-70 transition-colors cursor-pointer"
                >
                  {submitting
                    ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
                    : <><CreditCard size={14} /> Simpan Pembayaran</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
