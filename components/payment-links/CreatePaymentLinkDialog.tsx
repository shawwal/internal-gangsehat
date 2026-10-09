'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Landmark, Loader2, QrCode, Search, Wallet, X } from 'lucide-react'
import { createPaymentLink, listBranchesForPaymentLinks } from '@/app/actions/paymentLinks'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { DEFAULT_DUE_MINUTES, type PaymentLinkMethod } from '@/lib/doku/channels'
import { formatCurrency } from '@/lib/utils'
import type { PaymentLinkTarget, PaymentLinkView } from './types'

// Income categories aligned with Excel KATEGORI PEMBELIAN (finance/transactions)
const INCOME_CATEGORIES = [
  'TA KLINIK', 'PAKET KLINIK', 'SESI KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'TOKO', 'LAINNYA',
]

const DUE_OPTIONS: Record<PaymentLinkMethod, { label: string; minutes: number }[]> = {
  QRIS: [
    { label: '15 menit', minutes: 15 },
    { label: '30 menit', minutes: 30 },
    { label: '1 jam', minutes: 60 },
    { label: '24 jam', minutes: 1440 },
  ],
  VA: [
    { label: '3 jam', minutes: 180 },
    { label: '24 jam', minutes: 1440 },
    { label: '3 hari', minutes: 4320 },
  ],
}

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

interface Props {
  target?: PaymentLinkTarget
  onClose: () => void
  onCreated: (link: PaymentLinkView) => void
}

/** Generate a DOKU payment link (QRIS / VA). Works standalone (pick a patient)
 *  or prefilled from a visit / order / outstanding balance. */
export function CreatePaymentLinkDialog({ target = {}, onClose, onCreated }: Props) {
  const locked = !!(target.visitId || target.orderId)
  const [method, setMethod] = useState<PaymentLinkMethod>('QRIS')
  const [dueMinutes, setDueMinutes] = useState(DEFAULT_DUE_MINUTES.QRIS)
  const [amount, setAmount] = useState(target.amount ? String(target.amount) : '')
  const [category, setCategory] = useState(target.category ?? 'SESI KLINIK')
  const [description, setDescription] = useState(target.description ?? '')
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(
    target.patientId ? { id: target.patientId, name: target.patientName ?? 'Pasien' } : null,
  )
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchId, setBranchId] = useState('')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PatientPlain[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (locked) return
    listBranchesForPaymentLinks().then((b) => {
      setBranches(b)
      if (b.length === 1) setBranchId(b[0].id)
    })
  }, [locked])

  const searchActive = !patient && term.trim().length >= 2
  const shownResults = searchActive ? results : []
  useEffect(() => {
    if (!searchActive) return
    let cancelled = false
    const t = setTimeout(() => {
      setSearching(true)
      searchPatients(term).then((r) => {
        if (!cancelled) { setResults(r); setSearching(false) }
      })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [term, searchActive])

  function pickMethod(m: PaymentLinkMethod) {
    setMethod(m)
    setDueMinutes(DEFAULT_DUE_MINUTES[m])
  }

  const amountNum = Math.round(Number(amount) || 0)

  async function submit() {
    if (submitting) return
    if (amountNum < 1000) { setError('Nominal minimal Rp1.000'); return }
    if (!patient && !customerName.trim()) { setError('Pilih pasien atau isi nama pembayar'); return }
    if (!locked && branches.length > 1 && !branchId) { setError('Pilih cabang'); return }
    setSubmitting(true)
    setError(null)
    const res = await createPaymentLink({
      method,
      amount: amountNum,
      category,
      description: description || null,
      patientId: patient?.id ?? null,
      visitId: target.visitId ?? null,
      orderId: target.orderId ?? null,
      harga: target.harga ?? null,
      discount: target.discount ?? null,
      customerName: patient ? null : customerName,
      customerPhone: patient ? null : customerPhone,
      branchId: branchId || null,
      dueMinutes,
    })
    setSubmitting(false)
    if (res.error || !res.data) { setError(res.error ?? 'Gagal membuat link'); return }
    onCreated(res.data)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={submitting ? undefined : onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Link Pembayaran Online</p>
              <p className="text-xs text-muted-foreground">DOKU · QRIS atau Virtual Account</p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Method */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { m: 'QRIS' as const, icon: QrCode, title: 'QRIS', sub: 'Scan di klinik / e-wallet' },
              { m: 'VA' as const, icon: Landmark, title: 'Virtual Account', sub: 'Transfer via bank' },
            ]).map(({ m, icon: Icon, title, sub }) => (
              <button
                key={m}
                type="button"
                onClick={() => pickMethod(m)}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  method === m ? 'bg-primary/15 border-primary/50' : 'border-border hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={method === m ? 'text-primary' : 'text-muted-foreground'} />
                <span className={`text-sm font-semibold ${method === m ? 'text-primary' : 'text-foreground'}`}>{title}</span>
                <span className="text-[11px] text-muted-foreground">{sub}</span>
              </button>
            ))}
          </div>

          {/* Patient / payer */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Pasien</label>
            {patient ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-white/5">
                <span className="text-sm text-foreground truncate">{patient.name}</span>
                {!target.patientId && (
                  <button type="button" onClick={() => setPatient(null)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Ganti</button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cari nama pasien…" className={inputCls + ' pl-9'} />
                  {searchActive && searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                {shownResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-white/5">
                    {shownResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPatient({ id: p.id, name: p.name }); setTerm('') }}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 cursor-pointer"
                      >
                        <p className="text-sm text-foreground">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.no_rm ?? '—'} · {p.phone || 'tanpa no. HP'}</p>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Atau isi manual untuk pembayar non-pasien:</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama pembayar" className={inputCls} />
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="No. WhatsApp" inputMode="tel" className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {!locked && branches.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Cabang</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls + ' cursor-pointer'}>
                <option value="">Pilih cabang…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nominal (Rp)</label>
              <input type="number" min="1000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!!target.orderId} className={inputCls + ' cursor-pointer disabled:opacity-60'}>
                {INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                {!INCOME_CATEGORIES.includes(category) && <option value={category}>{category}</option>}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Keterangan <span className="text-muted-foreground font-normal">(opsional)</span>
            </label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="mis. Paket 10 sesi" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Berlaku</label>
            <div className="flex flex-wrap gap-1.5">
              {DUE_OPTIONS[method].map((o) => (
                <button
                  key={o.minutes}
                  type="button"
                  onClick={() => setDueMinutes(o.minutes)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    dueMinutes === o.minutes ? 'bg-primary/20 border-primary/50 text-primary' : 'border-border text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {target.harga != null && target.harga > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Tagihan {formatCurrency(Math.max(target.harga - (target.discount ?? 0), 0))}
              {amountNum > 0 && amountNum < target.harga - (target.discount ?? 0) ? ' · akan tercatat sebagai DP' : ''}
            </p>
          )}

          {error && (
            <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 cursor-pointer">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-70 cursor-pointer"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Membuat link…</> : <>Buat link {method} · {formatCurrency(amountNum)}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
