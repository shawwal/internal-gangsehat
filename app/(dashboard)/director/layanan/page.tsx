'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchLayananByBranch,
  updateLayananHarga,
  toggleLayananActive,
  upsertLayanan,
  deleteLayanan,
  type LayananRow,
} from '@/app/actions/layanan'

const KATEGORI_OPTIONS = [
  'TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA',
]

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

interface Branch { id: string; name: string }

const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

export default function LayananPage() {
  const [branches, setBranches]           = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [rows, setRows]                   = useState<LayananRow[]>([])
  const [loading, setLoading]             = useState(false)

  // inline price edit
  const [editId, setEditId]       = useState<string | null>(null)
  const [editHarga, setEditHarga] = useState('')
  const [saving, setSaving]       = useState(false)

  // delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // add new row modal
  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState({ nama: '', kategori: KATEGORI_OPTIONS[0], jumlah_sesi: '', harga: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError]   = useState<string | null>(null)

  // load branches once
  useEffect(() => {
    createClient()
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const list = (data ?? []) as Branch[]
        setBranches(list)
        if (list.length > 0) setSelectedBranch(list[0].id)
      })
  }, [])

  // load layanan when branch changes
  useEffect(() => {
    if (!selectedBranch) return
    setLoading(true)
    fetchLayananByBranch(selectedBranch).then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [selectedBranch])

  function reload() {
    if (!selectedBranch) return
    fetchLayananByBranch(selectedBranch).then(setRows)
  }

  // ── Inline price save ────────────────────────────────────────────────────────
  async function handleSaveHarga(id: string) {
    const val = Number(editHarga.replace(/\./g, '').replace(',', '.'))
    if (isNaN(val) || val < 0) return
    setSaving(true)
    await updateLayananHarga(id, val)
    setSaving(false)
    setEditId(null)
    reload()
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function handleToggle(id: string, current: boolean) {
    await toggleLayananActive(id, !current)
    reload()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeleting(true)
    await deleteLayanan(id)
    setDeleting(false)
    setDeleteId(null)
    reload()
  }

  // ── Add new ──────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!selectedBranch || !addForm.nama.trim()) {
      setAddError('Nama wajib diisi.')
      return
    }
    setAddSaving(true)
    setAddError(null)
    const { error } = await upsertLayanan({
      id:          crypto.randomUUID(),
      branch_id:   selectedBranch,
      nama:        addForm.nama.trim(),
      kategori:    addForm.kategori,
      jumlah_sesi: addForm.jumlah_sesi ? Number(addForm.jumlah_sesi) : null,
      harga:       Number(addForm.harga) || 0,
      is_active:   true,
    })
    setAddSaving(false)
    if (error) { setAddError(error); return }
    setShowAdd(false)
    setAddForm({ nama: '', kategori: KATEGORI_OPTIONS[0], jumlah_sesi: '', harga: '' })
    reload()
  }

  const activeBranch = branches.find((b) => b.id === selectedBranch)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tarif Layanan</h1>
          <p className="text-sm text-muted-foreground">
            Atur harga per jenis layanan untuk setiap cabang
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              value={selectedBranch ?? ''}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
          >
            <Plus size={15} /> Tambah Layanan
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin" /> Memuat...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <p className="text-sm">Belum ada layanan untuk {activeBranch?.name ?? 'cabang ini'}.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              + Tambah sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategori</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sesi</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga (Rp)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aktif</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.map((row) => (
                  <tr key={row.id} className={`transition-colors ${row.is_active ? 'hover:bg-muted/10' : 'opacity-50 hover:bg-muted/10'}`}>
                    {/* Nama */}
                    <td className="px-4 py-3 font-medium text-foreground">{row.nama}</td>

                    {/* Kategori */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                        {row.kategori}
                      </span>
                    </td>

                    {/* Jumlah sesi */}
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {row.jumlah_sesi ?? '—'}
                    </td>

                    {/* Harga — inline edit */}
                    <td className="px-4 py-3 text-right">
                      {editId === row.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            value={editHarga}
                            onChange={(e) => setEditHarga(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveHarga(row.id)
                              if (e.key === 'Escape') setEditId(null)
                            }}
                            className="w-36 px-2 py-1 border border-primary rounded-lg text-sm bg-input text-right focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button
                            onClick={() => handleSaveHarga(row.id)}
                            disabled={saving}
                            className="p-1 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
                          >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(row.id); setEditHarga(String(row.harga)) }}
                          className="group flex items-center justify-end gap-2 ml-auto hover:text-primary transition-colors cursor-pointer"
                          title="Klik untuk edit harga"
                        >
                          <span className={`font-semibold tabular-nums ${row.harga === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {row.harga === 0 ? '—' : fmt(row.harga)}
                          </span>
                          <Pencil size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      )}
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleToggle(row.id, row.is_active)}
                          className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer focus:outline-none ${
                            row.is_active ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                              row.is_active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-3">
                      {deleteId === row.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(row.id)}
                            disabled={deleting}
                            className="px-2 py-1 rounded-lg bg-destructive text-white text-xs font-medium hover:bg-destructive/90 transition-colors cursor-pointer"
                          >
                            {deleting ? <Loader2 size={12} className="animate-spin" /> : 'Hapus'}
                          </button>
                          <button
                            onClick={() => setDeleteId(null)}
                            className="px-2 py-1 rounded-lg border border-border text-xs hover:bg-muted transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteId(row.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Hapus layanan"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="glass-card w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h2 className="text-base font-semibold">Tambah Layanan</h2>
                <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Nama Layanan</label>
                  <input
                    value={addForm.nama}
                    onChange={(e) => setAddForm((f) => ({ ...f, nama: e.target.value }))}
                    placeholder="mis. Terapi Awal, Paket 10 Sesi"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Kategori</label>
                    <select
                      value={addForm.kategori}
                      onChange={(e) => setAddForm((f) => ({ ...f, kategori: e.target.value }))}
                      className={inputCls + ' cursor-pointer'}
                    >
                      {KATEGORI_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Jumlah Sesi <span className="text-muted-foreground font-normal">(opsional)</span></label>
                    <input
                      type="number"
                      min="1"
                      value={addForm.jumlah_sesi}
                      onChange={(e) => setAddForm((f) => ({ ...f, jumlah_sesi: e.target.value }))}
                      placeholder="—"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">Harga (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.harga}
                    onChange={(e) => setAddForm((f) => ({ ...f, harga: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>

                {addError && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{addError}</p>
                )}
              </div>

              <div className="flex gap-3 p-5 border-t border-border/30">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addSaving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {addSaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
