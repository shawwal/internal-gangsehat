'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X, Check, Loader2, Search, UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { updateTransaction } from '@/app/actions/transactions'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'

const INCOME_CATEGORIES = ['TA KLINIK', 'PAKET KLINIK', 'SESI KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA']
const EXPENSE_CATEGORIES = ['BEBAN PELAYANAN', 'GAJI', 'SEWA', 'LISTRIK', 'MARKETING', 'TUKAR TUNAI', 'LAINNYA']
const PAYMENT_METHODS = ['TUNAI', 'TRANSFER BCA', 'EDC BCA']
const PAYMENT_STATUSES = ['LUNAS', 'DP', 'PELUNASAN']

const CLINICAL_INCOME = new Set(['TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT'])

function formatRp(n: number) {
  if (!n) return ''
  return new Intl.NumberFormat('id-ID').format(n)
}
function parseRp(s: string): number {
  return Number(s.replace(/\D/g, '')) || 0
}

export interface TransactionForEdit {
  id: string
  type: string
  category: string
  harga: number | null
  discount: number | null
  amount: number | null
  payment_method: string | null
  payment_status: string | null
  penjamin: string | null
  description: string | null
  transaction_date: string
  patient_id: string | null
  patient_name: string | null
}

type Status = 'idle' | 'saving' | 'success' | 'error'

interface PatientResult { id: string; name: string; no_rm: string | null }

export function EditTransactionSheet({ transaction }: { transaction: TransactionForEdit }) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [mounted, setMounted]   = useState(false)
  const [status, setStatus]     = useState<Status>('idle')
  const [errMsg, setErrMsg]     = useState('')

  // Form state
  const [type, setType]                     = useState(transaction.type)
  const [category, setCategory]             = useState(transaction.category)
  const [harga, setHarga]                   = useState(formatRp(transaction.harga ?? 0))
  const [amount, setAmount]                 = useState(formatRp(transaction.amount ?? 0))
  const [discount, setDiscount]             = useState(formatRp(transaction.discount ?? 0))
  const [payMethod, setPayMethod]           = useState(transaction.payment_method ?? 'TUNAI')
  const [payStatus, setPayStatus]           = useState(transaction.payment_status ?? 'LUNAS')
  const [description, setDescription]       = useState(transaction.description ?? '')
  const [txDate, setTxDate]                 = useState(transaction.transaction_date.split('T')[0])
  const [patientId, setPatientId]           = useState<string | null>(transaction.patient_id)
  const [patientName, setPatientName]       = useState<string | null>(transaction.patient_name)

  // Patient search
  const [patientQuery, setPatientQuery]     = useState('')
  const [patientResults, setPatientResults] = useState<PatientResult[]>([])
  const [searching, setSearching]           = useState(false)
  const [showResults, setShowResults]       = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Reset form when transaction changes (re-open)
  useEffect(() => {
    if (!open) return
    setType(transaction.type)
    setCategory(transaction.category)
    setHarga(formatRp(transaction.harga ?? 0))
    setAmount(formatRp(transaction.amount ?? 0))
    setDiscount(formatRp(transaction.discount ?? 0))
    setPayMethod(transaction.payment_method ?? 'TUNAI')
    setPayStatus(transaction.payment_status ?? 'LUNAS')
    setDescription(transaction.description ?? '')
    setTxDate(transaction.transaction_date.split('T')[0])
    setPatientId(transaction.patient_id)
    setPatientName(transaction.patient_name)
    setPatientQuery('')
    setPatientResults([])
    setStatus('idle')
    setErrMsg('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Update category when type changes (if current category belongs to wrong list)
  useEffect(() => {
    const validCats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!validCats.includes(category)) {
      setCategory(validCats[0])
    }
  }, [type, category])

  // Close patient results on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const doPatientSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setPatientResults([]); return }
    setSearching(true)
    const results = await searchPatients(q)
    setPatientResults(results)
    setSearching(false)
    setShowResults(true)
  }, [])

  function handlePatientQueryChange(q: string) {
    setPatientQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doPatientSearch(q), 300)
  }

  function selectPatient(p: PatientResult) {
    setPatientId(p.id)
    setPatientName(p.name)
    setPatientQuery('')
    setPatientResults([])
    setShowResults(false)
  }

  function clearPatient() {
    setPatientId(null)
    setPatientName(null)
  }

  function close() {
    if (status === 'saving') return
    setOpen(false)
  }

  const isIncome = type === 'income'
  const hargaNum  = parseRp(harga)
  const amountNum = parseRp(amount)
  const discountNum = parseRp(discount)
  const sisa = isIncome ? Math.max(hargaNum - amountNum - discountNum, 0) : 0

  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function handleSave() {
    if (status === 'saving') return
    setStatus('saving')
    setErrMsg('')

    const { error } = await updateTransaction(transaction.id, {
      type,
      category,
      harga:            hargaNum,
      amount:           amountNum,
      discount:         discountNum,
      payment_method:   payMethod,
      payment_status:   isIncome ? payStatus : null,
      description:      description || null,
      transaction_date: txDate,
      patient_id:       patientId ?? null,
    })

    if (error) {
      setStatus('error')
      setErrMsg(error)
      setTimeout(() => setStatus('idle'), 600)
    } else {
      setStatus('success')
      setTimeout(() => { close(); router.refresh() }, 900)
    }
  }

  const isClinicalIncome = isIncome && CLINICAL_INCOME.has(category)

  const sheet = (
    <>
      <style>{`
        @keyframes editSheetBdIn  { from{opacity:0} to{opacity:1} }
        @keyframes editSheetIn    { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes editShakeBtn   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
        @keyframes editSuccessPop { 0%{transform:scale(0.7)} 60%{transform:scale(1.15)} 100%{transform:scale(1)} }
      `}</style>

      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        style={{ animation: 'editSheetBdIn 200ms ease forwards' }}
        onClick={close}
      />

      <div
        className="fixed right-0 top-0 bottom-0 z-[201] w-full max-w-md bg-gray-950 border-l border-white/10 flex flex-col shadow-2xl"
        style={{ animation: 'editSheetIn 300ms cubic-bezier(0.34,1.56,0.64,1) forwards' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Edit Transaksi</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{transaction.id.slice(0, 8)}…</p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Type toggle */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Jenis</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
              {(['expense', 'income'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                    type === t
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
              value={txDate}
              onChange={e => setTxDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Kategori</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Patient assignment */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Pasien
              {isClinicalIncome && !patientId && (
                <span className="ml-2 text-[10px] text-[#FFB35C] font-semibold normal-case">Wajib untuk kategori ini</span>
              )}
            </label>

            {patientId ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#34C759]/30 bg-[#34C759]/8">
                <div>
                  <p className="text-sm font-medium text-foreground">{patientName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{patientId.slice(0, 8)}…</p>
                </div>
                <button
                  type="button"
                  onClick={clearPatient}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Hapus pasien"
                >
                  <UserMinus size={14} />
                </button>
              </div>
            ) : (
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  {searching && (
                    <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                  )}
                  <input
                    type="text"
                    value={patientQuery}
                    onChange={e => handlePatientQueryChange(e.target.value)}
                    onFocus={() => patientResults.length > 0 && setShowResults(true)}
                    placeholder="Cari nama pasien…"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                {showResults && patientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/8 transition-colors text-left"
                      >
                        <span className="text-sm text-foreground">{p.name}</span>
                        {p.no_rm && <span className="text-[10px] text-muted-foreground font-mono">{p.no_rm}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {showResults && patientQuery.length >= 2 && patientResults.length === 0 && !searching && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-white/10 bg-gray-900/95 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Tidak ada pasien ditemukan</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Harga */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {isIncome ? 'Harga' : 'Nominal'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">Rp</span>
              <input
                type="text" inputMode="numeric"
                value={isIncome ? harga : amount}
                onChange={e => {
                  const raw = formatRp(parseRp(e.target.value))
                  if (isIncome) { setHarga(raw); setAmount(raw) }
                  else { setAmount(raw); setHarga(raw) }
                }}
                placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Income-only: jumlah bayar + diskon */}
          {isIncome && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Jumlah Bayar</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">Rp</span>
                    <input
                      type="text" inputMode="numeric"
                      value={amount}
                      onChange={e => setAmount(formatRp(parseRp(e.target.value)))}
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
                      value={discount}
                      onChange={e => setDiscount(formatRp(parseRp(e.target.value)))}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-input text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                sisa === 0 ? 'border-[#34C759]/30 bg-[#34C759]/8' : 'border-[#FFB35C]/30 bg-[#FFB35C]/8'
              }`}>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sisa</span>
                <span className={`font-mono text-sm font-bold ${sisa === 0 ? 'text-[#34C759]' : 'text-[#FFB35C]'}`}>
                  Rp {sisa.toLocaleString('id-ID')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Status Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPayStatus(s)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        payStatus === s
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
                  onClick={() => setPayMethod(m)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    payMethod === m
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
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Catatan tambahan…"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {errMsg || 'Terjadi kesalahan. Coba lagi.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <button
            onClick={handleSave}
            disabled={status === 'saving' || status === 'success'}
            className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              status === 'success'
                ? 'bg-[#34C759] text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-60'
            }`}
            style={
              status === 'error'   ? { animation: 'editShakeBtn 400ms ease' } :
              status === 'success' ? { animation: 'editSuccessPop 400ms ease' } : {}
            }
          >
            {status === 'saving'  && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {status === 'success' && <Check size={16} />}
            {status === 'success' ? 'Tersimpan!' : status === 'saving' ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit transaksi"
        className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground/50 hover:text-foreground transition-colors"
      >
        <Pencil size={13} />
      </button>
      {mounted && open && createPortal(sheet, document.body)}
    </>
  )
}
