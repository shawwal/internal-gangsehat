'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Check, X, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import {
  fetchLayananByBranch, updateLayananHarga, toggleLayananActive, upsertLayanan, deleteLayanan,
  type LayananRow,
} from '@/app/actions/layanan'
import { resolveGriyaBranchId } from '@/app/actions/griyaJadwal'
import { createClient } from '@/lib/supabase/client'

const KATEGORI_OPTIONS = ['TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK', 'LAINNYA']
const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function GriyaPengaturanPage() {
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [rows, setRows] = useState<LayananRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editHarga, setEditHarga] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ nama: '', kategori: KATEGORI_OPTIONS[0], jumlah_sesi: '', harga: '' })
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const bid = await resolveGriyaBranchId()
      setBranchId(bid)
      if (!bid) { setEnabled(false); setLoading(false); return }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('internal_profiles').select('role').eq('id', user!.id).single()
      const { data: s } = await supabase.from('branch_griya_settings').select('enabled').eq('branch_id', bid).maybeSingle()
      setEnabled(profile?.role === 'director' ? true : (s?.enabled ?? false))
    })()
  }, [])

  function reload() {
    if (!branchId) return
    setLoading(true)
    fetchLayananByBranch(branchId).then((rs) => { setRows(rs); setLoading(false) })
  }
  useEffect(() => { if (branchId) reload() }, [branchId])

  async function saveHarga(id: string) {
    const { error } = await updateLayananHarga(id, Number(editHarga.replace(/\./g, '')))
    if (error) { alert(error); return }
    setEditId(null); reload()
  }
  async function toggleActive(row: LayananRow) { await toggleLayananActive(row.id, !row.is_active); reload() }
  async function remove(id: string) {
    if (!confirm('Hapus layanan ini?')) return
    const { error } = await deleteLayanan(id)
    if (error) { alert(error); return }
    reload()
  }
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    if (!addForm.nama.trim()) { setAddError('Nama wajib diisi'); return }
    if (!branchId) return
    const { error } = await upsertLayanan({
      id: crypto.randomUUID(),
      branch_id: branchId,
      nama: addForm.nama.trim(),
      kategori: addForm.kategori,
      jumlah_sesi: addForm.jumlah_sesi ? Number(addForm.jumlah_sesi) : null,
      harga: Number(addForm.harga.replace(/\./g, '')) || 0,
      is_active: true,
    })
    if (error) { setAddError(error); return }
    setShowAdd(false)
    setAddForm({ nama: '', kategori: KATEGORI_OPTIONS[0], jumlah_sesi: '', harga: '' })
    reload()
  }

  if (branchId === null || enabled === false) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>
  }

  const hasZeroPrice = rows.some((r) => r.is_active && r.harga === 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Paket &amp; Tarif Griya Anak</h1>
        <p className="text-sm text-muted-foreground">Daftar layanan dan harga khusus cabang Griya Anak (tidak dibagi dengan cabang lain).</p>
      </div>

      {hasZeroPrice && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm">
          <AlertTriangle size={15} /> Ada layanan dengan harga Rp 0 — atur harga sebenarnya di bawah.
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Layanan &amp; Harga</h3>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
            <Plus size={13} /> Tambah
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Memuat...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nama</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Kategori</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Sesi</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Harga</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-border last:border-0 ${!r.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2 font-medium text-foreground">{r.nama}</td>
                  <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{r.kategori}</td>
                  <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{r.jumlah_sesi ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {editId === r.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <input autoFocus value={editHarga} onChange={(e) => setEditHarga(e.target.value)} className={`${inputCls} w-28 text-right py-1`} />
                        <button onClick={() => saveHarga(r.id)} className="p-1 text-[#34C759]"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className="p-1 text-destructive"><X size={14} /></button>
                      </div>
                    ) : (
                      <span className={r.harga === 0 ? 'text-amber-400' : ''}>{rp(r.harga)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {editId !== r.id && (
                        <button onClick={() => { setEditId(r.id); setEditHarga(String(r.harga)) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Edit harga"><Pencil size={13} /></button>
                      )}
                      <button onClick={() => toggleActive(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title={r.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                        {r.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" title="Hapus"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Belum ada layanan.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="glass-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-foreground mb-4">Tambah Layanan</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <input value={addForm.nama} onChange={(e) => setAddForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Nama layanan" className={inputCls} />
              <select value={addForm.kategori} onChange={(e) => setAddForm((f) => ({ ...f, kategori: e.target.value }))} className={inputCls}>
                {KATEGORI_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={addForm.jumlah_sesi} onChange={(e) => setAddForm((f) => ({ ...f, jumlah_sesi: e.target.value }))} placeholder="Jumlah sesi" className={inputCls} />
                <input value={addForm.harga} onChange={(e) => setAddForm((f) => ({ ...f, harga: e.target.value }))} placeholder="Harga (Rp)" className={inputCls} />
              </div>
              {addError && <p className="text-xs text-destructive">{addError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">Batal</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
