'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, EyeOff, Eye } from 'lucide-react'
import {
  fetchLayananByBranch, updateLayananHarga, toggleLayananActive, upsertLayanan, deleteLayanan,
  type LayananRow,
} from '@/app/actions/layanan'
import {
  fetchExpenseCategories, addExpenseCategory, renameExpenseCategory,
  toggleExpenseCategoryActive, deleteExpenseCategory, type ExpenseCategoryRow,
} from '@/app/actions/accounting'
import { formatRp, inputCls } from './shared'

interface Props {
  branchId: string
}

const KATEGORI_OPTIONS = ['TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'LAINNYA']

export function PengaturanTab({ branchId }: Props) {
  return (
    <div className="space-y-6">
      <LayananSection branchId={branchId} />
      <ExpenseCategorySection branchId={branchId} />
    </div>
  )
}

function LayananSection({ branchId }: { branchId: string }) {
  const [rows, setRows] = useState<LayananRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editHarga, setEditHarga] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ nama: '', kategori: KATEGORI_OPTIONS[0], jumlah_sesi: '', harga: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    fetchLayananByBranch(branchId).then((rs) => { setRows(rs); setLoading(false) })
  }
  useEffect(() => { reload() }, [branchId])

  async function saveHarga(id: string) {
    const val = Number(editHarga.replace(/\./g, ''))
    const { error } = await updateLayananHarga(id, val)
    if (error) { alert(error); return }
    setEditId(null)
    reload()
  }

  async function toggleActive(row: LayananRow) {
    await toggleLayananActive(row.id, !row.is_active)
    reload()
  }

  async function remove(id: string) {
    if (!confirm('Hapus layanan ini?')) return
    const { error } = await deleteLayanan(id)
    if (error) { alert(error); return }
    reload()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    if (!addForm.nama.trim() || !addForm.harga) { setAddError('Nama dan harga wajib diisi'); return }
    setAddSaving(true)
    const { error } = await upsertLayanan({
      id: crypto.randomUUID(),
      branch_id: branchId,
      nama: addForm.nama.trim(),
      kategori: addForm.kategori,
      jumlah_sesi: addForm.jumlah_sesi ? Number(addForm.jumlah_sesi) : null,
      harga: Number(addForm.harga.replace(/\./g, '')),
      is_active: true,
    })
    setAddSaving(false)
    if (error) { setAddError(error); return }
    setShowAdd(false)
    setAddForm({ nama: '', kategori: KATEGORI_OPTIONS[0], jumlah_sesi: '', harga: '' })
    reload()
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Jenis Pemeriksaan &amp; Harga Paket</h3>
          <p className="text-xs text-muted-foreground">Daftar layanan dan harga cabang Anda</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
          <Plus size={13} /> Tambah
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Memuat...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nama Layanan</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Kategori</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Harga</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-border last:border-0 ${!r.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 font-medium text-foreground">{r.nama}</td>
                <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{r.kategori}</td>
                <td className="px-4 py-2 text-right">
                  {editId === r.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <input autoFocus value={editHarga} onChange={(e) => setEditHarga(e.target.value)} className={`${inputCls} w-28 text-right py-1`} />
                      <button onClick={() => saveHarga(r.id)} className="p-1 text-chart-4"><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} className="p-1 text-destructive"><X size={14} /></button>
                    </div>
                  ) : (
                    <span>{formatRp(r.harga)}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {editId !== r.id && (
                      <button onClick={() => { setEditId(r.id); setEditHarga(String(r.harga)) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title="Edit harga"><Pencil size={13} /></button>
                    )}
                    <button onClick={() => toggleActive(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title={r.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                      {r.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Hapus"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Belum ada layanan.</td></tr>}
          </tbody>
        </table>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">Tambah Layanan</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nama Layanan</label>
                <input value={addForm.nama} onChange={(e) => setAddForm((f) => ({ ...f, nama: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Kategori</label>
                <select value={addForm.kategori} onChange={(e) => setAddForm((f) => ({ ...f, kategori: e.target.value }))} className={inputCls}>
                  {KATEGORI_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Jumlah Sesi (opsional)</label>
                  <input type="number" value={addForm.jumlah_sesi} onChange={(e) => setAddForm((f) => ({ ...f, jumlah_sesi: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Harga (Rp)</label>
                  <input value={addForm.harga} onChange={(e) => setAddForm((f) => ({ ...f, harga: e.target.value }))} className={inputCls} />
                </div>
              </div>
              {addError && <p className="text-xs text-destructive">{addError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" disabled={addSaving} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {addSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ExpenseCategorySection({ branchId }: { branchId: string }) {
  const [rows, setRows] = useState<ExpenseCategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function reload() {
    setLoading(true)
    fetchExpenseCategories(branchId).then((rs) => { setRows(rs); setLoading(false) })
  }
  useEffect(() => { reload() }, [branchId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const { error } = await addExpenseCategory(newName)
    setAdding(false)
    if (error) { alert(error); return }
    setNewName('')
    reload()
  }

  async function saveRename(id: string) {
    if (!editName.trim()) return
    const { error } = await renameExpenseCategory(id, editName)
    if (error) { alert(error); return }
    setEditId(null)
    reload()
  }

  async function toggleActive(row: ExpenseCategoryRow) {
    await toggleExpenseCategoryActive(row.id, !row.is_active)
    reload()
  }

  async function remove(id: string) {
    if (!confirm('Hapus kategori pengeluaran ini?')) return
    const { error } = await deleteExpenseCategory(id)
    if (error) { alert(error); return }
    reload()
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Jenis Pengeluaran</h3>
        <p className="text-xs text-muted-foreground">Kategori pengeluaran cabang Anda — tambahkan sesuai kebutuhan, mis. &quot;Saving THR&quot;</p>
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama kategori baru..." className={inputCls} />
        <button type="submit" disabled={adding} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
          <Plus size={14} /> Tambah
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Memuat...</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className={`flex items-center justify-between px-4 py-2.5 ${!r.is_active ? 'opacity-50' : ''}`}>
              {editId === r.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className={`${inputCls} py-1`} />
                  <button onClick={() => saveRename(r.id)} className="p-1 text-chart-4"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="p-1 text-destructive"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">{r.name}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditId(r.id); setEditName(r.name) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => toggleActive(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      {r.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </li>
          ))}
          {!rows.length && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada kategori.</li>}
        </ul>
      )}
    </div>
  )
}
