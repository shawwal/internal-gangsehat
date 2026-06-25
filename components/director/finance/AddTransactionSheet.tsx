'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Check, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createTransactionManual } from '@/app/actions/transactions'

const INCOME_CATEGORIES = ['TA KLINIK', 'PAKET KLINIK', 'SESI KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA']
const EXPENSE_CATEGORIES = ['BEBAN PELAYANAN', 'GAJI', 'SEWA', 'LISTRIK', 'MARKETING', 'TUKAR TUNAI', 'LAINNYA']
const PAYMENT_METHODS = ['TUNAI', 'TRANSFER BCA', 'EDC BCA']
const PAYMENT_STATUSES = ['LUNAS', 'DP', 'PELUNASAN']

function formatRp(n: number) {
  if (!n) return ''
  return new Intl.NumberFormat('id-ID').format(n)
}
function parseRp(s: string): number {
  return Number(s.replace(/\D/g, '')) || 0
}

const DEFAULT = {
  type:             'expense' as 'income' | 'expense',
  category:         EXPENSE_CATEGORIES[0],
  harga:            '',
  amount:           '',
  discount:         '',
  payment_method:   'TUNAI',
  payment_status:   'LUNAS',
  description:      '',
  transaction_date: new Date().toISOString().split('T')[0],
}

type Status = 'idle' | 'saving' | 'success' | 'error'

export function AddTransactionSheet() {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [form, setForm]   = useState(DEFAULT)
  const [status, setStatus] = useState<Status>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Reset category when type changes
  useEffect(() => {
    setForm(f => ({
      ...f,
      category: f.type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    }))
  }, [form.type])

  // Auto-suggest payment status for income
  useEffect(() => {
    if (form.type !== 'income') return
    const harga    = parseRp(form.harga)
    const amount   = parseRp(form.amount)
    const discount = parseRp(form.discount)
    const sisa     = Math.max(harga - amount - discount, 0)
    if (harga > 0 && sisa === 0) setForm(f => ({ ...f, payment_status: 'LUNAS' }))
    else if (amount > 0 && sisa > 0) setForm(f => ({ ...f, payment_status: 'DP' }))
  }, [form.harga, form.amount, form.discount, form.type])

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const isIncome   = form.type === 'income'
  const harga      = parseRp(form.harga)
  const amount     = parseRp(form.amount)
  const discount   = parseRp(form.discount)
  const sisa       = isIncome ? Math.max(harga - amount - discount, 0) : 0

  function close() {
    if (status === 'saving') return
    setOpen(false)
    setTimeout(() => { setForm(DEFAULT); setStatus('idle'); setErrMsg('') }, 300)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'saving') return
    setStatus('saving')
    setErrMsg('')

    const { error } = await createTransactionManual({
      type:             form.type,
      category:         form.category,
      harga:            isIncome ? parseRp(form.harga) : parseRp(form.amount),
      amount:           parseRp(form.amount),
      discount:         parseRp(form.discount),
      payment_method:   form.payment_method,
      payment_status:   isIncome ? form.payment_status : null,
      penjamin:         null,
      description:      form.description || null,
      transaction_date: form.transaction_date,
    })

    if (error) {
      setStatus('error')
      setErrMsg(error)
      setTimeout(() => setStatus('idle'), 600)
    } else {
      setStatus('success')
      setTimeout(() => {
        close()
        router.refresh()
      }, 900)
    }
  }

  const sheet = (
    <>
      <style>{`
        @keyframes sheetBdIn  { from{opacity:0} to{opacity:1} }
        @keyframes sheetBdOut { from{opacity:1} to{opacity:0} }
        @keyframes sheetIn    { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes sheetOut   { from{transform:translateX(0)} to{transform:translateX(100%)} }
        @keyframes shakeBtn   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
        @keyframes successPop { 0%{transform:scale(0.7)} 60%{transform:scale(1.15)} 100%{transform:scale(1)} }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        style={{ animation: `${open ? 'sheetBdIn' : 'sheetBdOut'} 200ms ease forwards` }}
        onClick={close}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[201] w-full max-w-md bg-gray-950 border-l border-white/10 flex flex-col shadow-2xl"
        style={{ animation: `${open ? 'sheetIn' : 'sheetOut'} 320ms cubic-bezier(0.34,1.56,0.64,1) forwards` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tambah Transaksi</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Catat pemasukan atau pengeluaran klinik</p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Type toggle */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Jenis</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                    form.type === t
                      ? t === 'expense'
                        ? 'bg-destructive text-white shadow'
                        : 'bg-[#34C759] text-white shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'expense' ? '⬆️ Pengeluaran' : '⬇️ Pemasukan'}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Tanggal</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Kategori</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Harga (income) / Nominal (expense) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {isIncome ? 'Harga' : 'Nominal'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={isIncome ? form.harga : form.amount}
                onChange={e => {
                  const raw = formatRp(parseRp(e.target.value))
                  if (isIncome) setForm(f => ({ ...f, harga: raw, amount: raw }))
                  else setForm(f => ({ ...f, amount: raw, harga: raw }))
                }}
                required
                placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Income-only fields */}
          {isIncome && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Jumlah Bayar</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">Rp</span>
                    <input
                      type="text" inputMode="numeric"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: formatRp(parseRp(e.target.value)) }))}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Diskon</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">Rp</span>
                    <input
                      type="text" inputMode="numeric"
                      value={form.discount}
                      onChange={e => setForm(f => ({ ...f, discount: formatRp(parseRp(e.target.value)) }))}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Sisa preview */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                sisa === 0 ? 'border-[#34C759]/30 bg-[#34C759]/8' : 'border-[#FFB35C]/30 bg-[#FFB35C]/8'
              }`}>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sisa</span>
                <span className={`font-mono text-sm font-bold ${sisa === 0 ? 'text-[#34C759]' : 'text-[#FFB35C]'}`}>
                  Rp {sisa.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Payment status */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Status Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, payment_status: s }))}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        form.payment_status === s
                          ? s === 'LUNAS'
                            ? 'bg-[#34C759]/20 border-[#34C759]/50 text-[#34C759]'
                            : 'bg-[#FFB35C]/20 border-[#FFB35C]/50 text-[#FFB35C]'
                          : 'border-border text-muted-foreground hover:bg-white/5'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Metode Bayar</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, payment_method: m }))}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    form.payment_method === m
                      ? 'bg-primary/20 border-primary/50 text-primary'
                      : 'border-border text-muted-foreground hover:bg-white/5'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Keterangan</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder={isIncome ? 'Catatan tambahan…' : 'Detail pengeluaran, e.g. beli sabun, bayar listrik…'}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Error message */}
          {status === 'error' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle size={15} />
              {errMsg || 'Terjadi kesalahan. Coba lagi.'}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={status === 'saving' || status === 'success'}
            className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              status === 'success'
                ? 'bg-[#34C759] text-white'
                : isIncome
                ? 'bg-[#34C759] hover:bg-[#34C759]/90 text-white disabled:opacity-60'
                : 'bg-destructive hover:bg-destructive/90 text-white disabled:opacity-60'
            }`}
            style={
              status === 'error' ? { animation: 'shakeBtn 400ms ease' } :
              status === 'success' ? { animation: 'successPop 400ms ease' } : {}
            }
          >
            {status === 'saving' && (
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
            {status === 'success' && <Check size={16} />}
            {status === 'success'
              ? 'Tersimpan!'
              : status === 'saving'
              ? 'Menyimpan…'
              : isIncome
              ? 'Simpan Pemasukan'
              : 'Simpan Pengeluaran'
            }
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <Plus size={16} />
        Tambah Transaksi
      </button>

      {/* Portal sheet */}
      {mounted && open && createPortal(sheet, document.body)}
    </>
  )
}
