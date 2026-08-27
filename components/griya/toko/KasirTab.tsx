'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Minus, Trash2, X } from 'lucide-react'
import { fetchProducts, createSale, type GriyaProduct } from '@/app/actions/griyaToko'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { useToast } from '@/context/ToastContext'

const PAYMENT_METHODS = ['TUNAI', 'TRANSFER BCA', 'EDC BCA', 'TRANSFER BANK KALBAR']
const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function KasirTab({ branchId }: { branchId: string }) {
  const { showToast } = useToast()
  const [products, setProducts] = useState<GriyaProduct[]>([])
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [discount, setDiscount] = useState('')
  const [method, setMethod] = useState(PAYMENT_METHODS[0])
  const [amountPaid, setAmountPaid] = useState('')
  const [saleDate, setSaleDate] = useState(todayIso())
  const [patient, setPatient] = useState<PatientPlain | null>(null)
  const [patientQ, setPatientQ] = useState('')
  const [patientResults, setPatientResults] = useState<PatientPlain[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchProducts(branchId, { activeOnly: true }).then(setProducts) }, [branchId])

  useEffect(() => {
    const term = patientQ.trim()
    if (term.length < 2) { setPatientResults([]); return }
    const t = setTimeout(() => { searchPatients(term).then((r) => setPatientResults(r.slice(0, 6))) }, 250)
    return () => clearTimeout(t)
  }, [patientQ])

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  const subtotal = useMemo(
    () => Object.entries(cart).reduce((s, [id, qty]) => s + (products.find((p) => p.id === id)?.price ?? 0) * qty, 0),
    [cart, products],
  )
  const disc = Number(discount.replace(/\D/g, '')) || 0
  const total = Math.max(subtotal - disc, 0)

  function add(p: GriyaProduct) {
    setCart((c) => {
      const next = (c[p.id] ?? 0) + 1
      if (next > p.stock) { showToast(`Stok ${p.name} hanya ${p.stock}`, 'error'); return c }
      return { ...c, [p.id]: next }
    })
  }
  function setQty(id: string, qty: number) {
    const p = products.find((x) => x.id === id)
    if (!p) return
    if (qty <= 0) { setCart((c) => { const n = { ...c }; delete n[id]; return n }) }
    else if (qty <= p.stock) setCart((c) => ({ ...c, [id]: qty }))
  }

  async function complete() {
    const items = Object.entries(cart).map(([product_id, qty]) => ({ product_id, qty }))
    if (items.length === 0) return
    setSaving(true)
    const { error } = await createSale({
      branch_id: branchId,
      patient_id: patient?.id ?? null,
      items,
      discount: disc,
      payment_method: method,
      amount_paid: amountPaid ? Number(amountPaid.replace(/\D/g, '')) : total,
      sale_date: saleDate,
    })
    setSaving(false)
    if (error) { showToast(error, 'error'); return }
    showToast('Penjualan tersimpan', 'success')
    setCart({}); setDiscount(''); setAmountPaid(''); setPatient(null); setPatientQ('')
    fetchProducts(branchId, { activeOnly: true }).then(setProducts)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {/* product picker */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk..." className={`${inputCls} pl-8`} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => add(p)} disabled={p.stock === 0}
              className="glass-card p-3 text-left hover:border-primary/50 transition-colors disabled:opacity-40 cursor-pointer">
              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{rp(p.price)} · stok {p.stock}</p>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-4 text-center">Tidak ada produk.</p>}
        </div>
      </div>

      {/* cart */}
      <div className="glass-card p-4 space-y-3 h-fit">
        <h3 className="text-sm font-semibold text-foreground">Keranjang</h3>
        {Object.keys(cart).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Belum ada item.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(cart).map(([id, qty]) => {
              const p = products.find((x) => x.id === id)!
              return (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{p.name}</span>
                  <button onClick={() => setQty(id, qty - 1)} className="p-1 rounded-md hover:bg-muted cursor-pointer"><Minus size={12} /></button>
                  <span className="w-5 text-center">{qty}</span>
                  <button onClick={() => setQty(id, qty + 1)} className="p-1 rounded-md hover:bg-muted cursor-pointer"><Plus size={12} /></button>
                  <span className="w-20 text-right text-xs">{rp(p.price * qty)}</span>
                  <button onClick={() => setQty(id, 0)} className="p-1 rounded-md hover:bg-destructive/10 text-destructive cursor-pointer"><Trash2 size={12} /></button>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-2 border-t border-border/40 space-y-2">
          {patient ? (
            <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-primary/10">
              <span>{patient.name}</span>
              <button onClick={() => setPatient(null)} className="cursor-pointer"><X size={12} /></button>
            </div>
          ) : (
            <div className="relative">
              <input value={patientQ} onChange={(e) => setPatientQ(e.target.value)} placeholder="Kaitkan ke anak (opsional)" className={`${inputCls} text-xs`} />
              {patientResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg max-h-40 overflow-y-auto">
                  {patientResults.map((r) => (
                    <button key={r.id} onClick={() => { setPatient(r); setPatientQ(''); setPatientResults([]) }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted cursor-pointer">{r.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Diskon (Rp)" inputMode="numeric" className={`${inputCls} text-xs`} />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputCls} text-xs`}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={`Bayar (default ${rp(total)})`} inputMode="numeric" className={`${inputCls} text-xs`} />
          <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={`${inputCls} text-xs`} />
        </div>

        <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-border/40">
          <span>Total</span><span>{rp(total)}</span>
        </div>
        <button onClick={complete} disabled={saving || total === 0}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer">
          {saving ? 'Menyimpan...' : 'Selesaikan Penjualan'}
        </button>
      </div>
    </div>
  )
}
