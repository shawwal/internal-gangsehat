'use client'

import { useEffect, useState } from 'react'
import { createPatientPackage } from '@/app/actions/packages'
import { createTransactionManual, fetchLayananDetail } from '@/app/actions/transactions'
import type { CreateTransactionManualInput } from '@/app/actions/transactions'
import { PACKAGE_CATEGORIES, type PackageCategory } from './types'

interface Props {
  patientId: string
  patientName: string
  branchId: string | null
  lockedCategory?: PackageCategory
  onCancel: () => void
  onSuccess: () => void
}

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const labelCls = 'block text-xs font-medium text-foreground mb-1.5'

export function PackageForm({ patientId, patientName, branchId, lockedCategory, onCancel, onSuccess }: Props) {
  const [category, setCategory] = useState<PackageCategory>(lockedCategory ?? 'PAKET KLINIK')
  const [jenis, setJenis]   = useState<'P1' | 'P2'>('P1')
  const [mulai, setMulai]   = useState<'NEW' | 'EXT.'>('NEW')
  const [nama, setNama]     = useState(() => `Paket Fisio ${jenis}`)
  const [namaTouched, setNamaTouched] = useState(false)
  const [harga, setHarga]   = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'TUNAI' | 'TRANSFER BCA' | 'EDC BCA'>('TUNAI')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const sessions = jenis === 'P1' ? 5 : 10
  const isVisit  = category === 'PAKET VISIT'

  // Auto-fill harga (and, unless the user already edited it, nama) from the
  // branch's price list (internal_layanan), keyed by category + session count —
  // e.g. pulls the real "Paket Home Visit" name for the PAKET VISIT category.
  useEffect(() => {
    let cancelled = false
    const virtualServiceType = isVisit ? 'PAKET VISIT' : 'PAKET TERAPI'
    fetchLayananDetail(virtualServiceType, branchId, sessions).then((detail) => {
      if (cancelled) return
      setHarga(detail ? String(detail.harga) : '')
      if (!namaTouched) setNama(detail?.nama ?? (isVisit ? `Paket Visit ${jenis}` : `Paket Fisio ${jenis}`))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisit, branchId, sessions])

  const hargaNum  = parseFloat(harga.replace(/\D/g, '')) || 0
  const amountNum = parseFloat(amount.replace(/\D/g, '')) || 0
  const sisa      = Math.max(hargaNum - amountNum, 0)
  const payStatus = sisa === 0 ? 'LUNAS' : 'DP'

  function handleJenis(j: 'P1' | 'P2') {
    setJenis(j)
    if (!namaTouched) setNama(isVisit ? `Paket Visit ${j}` : `Paket Fisio ${j}`)
  }

  function handleCategory(c: PackageCategory) {
    setCategory(c)
    if (!namaTouched) setNama(c === 'PAKET VISIT' ? `Paket Visit ${jenis}` : `Paket Fisio ${jenis}`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!harga || !amount) { setError('Isi harga dan jumlah bayar.'); return }
    setSaving(true)
    setError(null)

    const { id: pkgId, error: pkgErr } = await createPatientPackage({
      patient_id:  patientId,
      branch_id:   branchId,
      package_name: nama.trim() || (isVisit ? `Paket Visit ${jenis}` : `Paket Fisio ${jenis}`),
      jenis_paket:  jenis,
      mulai_paket:  mulai,
      category,
      notes:        notes.trim() || null,
    })

    if (pkgErr || !pkgId) {
      setSaving(false)
      setError(pkgErr ?? 'Gagal membuat paket.')
      return
    }

    const txInput: CreateTransactionManualInput = {
      type:             'income',
      category,
      harga:            hargaNum,
      amount:           amountNum,
      discount:         0,
      payment_method:   method,
      payment_status:   payStatus,
      penjamin:         null,
      description:      `${nama} — ${sessions} sesi`,
      transaction_date: new Date().toISOString().slice(0, 10),
      visit_id:         null,
      patient_id:       patientId,
      package_id:       pkgId,
      branch_id:        branchId,
    }

    const { error: txErr } = await createTransactionManual(txInput)

    setSaving(false)
    if (txErr) {
      setError(`Paket dibuat, tapi gagal mencatat pembayaran: ${txErr}`)
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Kategori */}
      {!lockedCategory && (
        <div>
          <label className={labelCls}>Kategori Paket</label>
          <div className="grid grid-cols-2 gap-2">
            {PACKAGE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleCategory(c)}
                className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                  category === c
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Jenis paket */}
      <div>
        <label className={labelCls}>Jenis Paket</label>
        <div className="grid grid-cols-2 gap-2">
          {(['P1', 'P2'] as const).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => handleJenis(j)}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                jenis === j
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              {j} · {j === 'P1' ? 5 : 10} sesi
            </button>
          ))}
        </div>
      </div>

      {/* Mulai paket */}
      <div>
        <label className={labelCls}>Mulai Paket</label>
        <div className="grid grid-cols-2 gap-2">
          {([['NEW', 'Baru'], ['EXT.', 'Lanjutan']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMulai(v)}
              className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                mulai === v
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Nama paket */}
      <div>
        <label className={labelCls}>Nama Paket</label>
        <input
          value={nama}
          onChange={(e) => { setNama(e.target.value); setNamaTouched(true) }}
          className={inputCls}
          placeholder="mis. Paket Fisio Lutut P1"
        />
      </div>

      {/* Harga & Bayar */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Harga Paket (Rp)</label>
          <input
            required
            type="number"
            min="0"
            value={harga}
            onChange={(e) => setHarga(e.target.value)}
            className={inputCls}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Jumlah Bayar (Rp)</label>
          <input
            required
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
            placeholder="0"
          />
        </div>
      </div>

      {/* Sisa */}
      {(hargaNum > 0 || amountNum > 0) && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium ${
          sisa === 0 ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#FFB35C]/10 text-[#FFB35C]'
        }`}>
          <span>{sisa === 0 ? 'Lunas' : 'Sisa tagihan'}</span>
          <span>{sisa === 0 ? '✓' : `Rp ${sisa.toLocaleString('id-ID')}`}</span>
        </div>
      )}

      {/* Metode bayar */}
      <div>
        <label className={labelCls}>Metode Pembayaran</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={inputCls}>
          <option value="TUNAI">TUNAI</option>
          <option value="TRANSFER BCA">TRANSFER BCA</option>
          <option value="EDC BCA">EDC BCA</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Catatan (opsional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Menyimpan...' : `Buat Paket untuk ${patientName.split(' ')[0]}`}
        </button>
      </div>
    </form>
  )
}
