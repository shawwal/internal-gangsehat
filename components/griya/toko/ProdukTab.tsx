'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, PackagePlus, Check, X } from 'lucide-react'
import {
  fetchProducts, upsertProduct, toggleProductActive, deleteProduct, adjustStock,
  type GriyaProduct,
} from '@/app/actions/griyaToko'

const CATEGORIES = ['BUKU', 'ALAT TERAPI', 'MERCHANDISE', 'LAINNYA']
const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const LOW_STOCK = 3

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export function ProdukTab({ branchId }: { branchId: string }) {
  const [rows, setRows] = useState<GriyaProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<GriyaProduct | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [restock, setRestock] = useState<GriyaProduct | null>(null)
  const [stockEditId, setStockEditId] = useState<string | null>(null)
  const [stockVal, setStockVal] = useState('')
  const [stockSaving, setStockSaving] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    fetchProducts(branchId).then((r) => { setRows(r); setLoading(false) })
  }, [branchId])
  useEffect(() => { reload() }, [reload])

  async function saveStock(p: GriyaProduct) {
    const target = Number(stockVal.replace(/[^\d-]/g, ''))
    if (Number.isNaN(target) || target === p.stock) { setStockEditId(null); return }
    setStockSaving(true)
    const delta = target - p.stock
    const { error } = await adjustStock(p.id, delta, delta > 0 ? 'restock' : 'adjustment', 'Set stok manual')
    setStockSaving(false)
    setStockEditId(null)
    if (error) { alert(error); return }
    reload()
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setEdit(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer">
          <Plus size={14} /> Produk Baru
        </button>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nama</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Kategori</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Harga</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Stok</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Memuat...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Belum ada produk.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className={`border-b border-border last:border-0 ${!p.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 font-medium text-foreground">{p.name}{p.sku && <span className="text-xs text-muted-foreground ml-2">{p.sku}</span>}</td>
                <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{p.category}</td>
                <td className="px-4 py-2 text-right">{rp(p.price)}</td>
                <td className="px-4 py-2 text-right">
                  {stockEditId === p.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        autoFocus
                        value={stockVal}
                        onChange={(e) => setStockVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveStock(p); if (e.key === 'Escape') setStockEditId(null) }}
                        inputMode="numeric"
                        className="w-16 px-2 py-1 text-right border border-border rounded-lg text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button disabled={stockSaving} onClick={() => saveStock(p)} className="p-1 text-[#34C759] cursor-pointer"><Check size={13} /></button>
                      <button onClick={() => setStockEditId(null)} className="p-1 text-destructive cursor-pointer"><X size={13} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setStockEditId(p.id); setStockVal(String(p.stock)) }}
                      className={`font-medium px-1.5 py-0.5 rounded-md hover:bg-muted cursor-pointer ${p.stock <= LOW_STOCK ? 'text-amber-400' : ''}`}
                      title="Klik untuk ubah stok"
                    >
                      {p.stock}
                    </button>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setRestock(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Stok masuk"><PackagePlus size={13} /></button>
                    <button onClick={() => { setEdit(p); setShowForm(true) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit"><Pencil size={13} /></button>
                    <button onClick={async () => { await toggleProductActive(p.id, !p.is_active); reload() }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title={p.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                      {p.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={async () => { if (confirm('Hapus produk ini?')) { await deleteProduct(p.id); reload() } }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" title="Hapus"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductForm
          branchId={branchId}
          product={edit}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload() }}
        />
      )}
      {restock && (
        <RestockForm
          product={restock}
          onClose={() => setRestock(null)}
          onSaved={() => { setRestock(null); reload() }}
        />
      )}
    </div>
  )
}

function ProductForm({ branchId, product, onClose, onSaved }: {
  branchId: string; product: GriyaProduct | null; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? CATEGORIES[0])
  const [sku, setSku] = useState(product?.sku ?? '')
  const [price, setPrice] = useState(String(product?.price ?? ''))
  const [stock, setStock] = useState(String(product?.stock ?? '0'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nama wajib diisi'); return }
    setSaving(true); setError(null)
    const { error } = await upsertProduct({
      id: product?.id,
      branch_id: branchId,
      name, category, sku: sku || null,
      price: Number(price.replace(/\D/g, '')) || 0,
      stock: product ? undefined : Number(stock.replace(/\D/g, '')) || 0,
    })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-foreground mb-4">{product ? 'Edit Produk' : 'Produk Baru'}</h2>
        <form onSubmit={save} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama produk" className={inputCls} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU (opsional)" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Harga (Rp)" inputMode="numeric" className={inputCls} />
            {!product && <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stok awal" inputMode="numeric" className={inputCls} />}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RestockForm({ product, onClose, onSaved }: { product: GriyaProduct; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(qty)
    if (!n) { setError('Isi jumlah'); return }
    setSaving(true); setError(null)
    const { error } = await adjustStock(product.id, n, n > 0 ? 'restock' : 'adjustment', note)
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-foreground mb-1">Sesuaikan Stok</h2>
        <p className="text-xs text-muted-foreground mb-4">{product.name} · stok sekarang {product.stock}</p>
        <form onSubmit={save} className="space-y-3">
          <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="+ tambah / - kurangi" inputMode="numeric" className={inputCls} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className={inputCls} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
              {saving ? '...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
