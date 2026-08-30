'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import {
  fetchLayananByBranch, toggleLayananActive, upsertLayanan, updateLayanan, deleteLayanan,
  type LayananRow,
} from '@/app/actions/layanan'
import { resolveGriyaBranchId } from '@/app/actions/griyaJadwal'
import { createClient } from '@/lib/supabase/client'

const KATEGORI_OPTIONS = ['TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'LAINNYA']
const inputCls = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'

function rp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

type FormState = { nama: string; kategori: string; jumlah_sesi: string; harga: string }
const BLANK: FormState = { nama: '', kategori: KATEGORI_OPTIONS[0], jumlah_sesi: '', harga: '' }

export default function GriyaPengaturanPage() {
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [rows, setRows] = useState<LayananRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; row: LayananRow } | null>(null)

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

  async function toggleActive(row: LayananRow) { await toggleLayananActive(row.id, !row.is_active); reload() }
  async function remove(id: string) {
    if (!confirm('Hapus layanan ini?')) return
    const { error } = await deleteLayanan(id)
    if (error) { alert(error); return }
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
          <button onClick={() => setModal({ mode: 'add' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
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
                    <span className={r.harga === 0 ? 'text-amber-400' : ''}>{rp(r.harga)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModal({ mode: 'edit', row: r })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Ubah layanan"><Pencil size={13} /></button>
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

      {modal && branchId && (
        <LayananModal
          branchId={branchId}
          row={modal.mode === 'edit' ? modal.row : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); reload() }}
        />
      )}
    </div>
  )
}

function LayananModal({ branchId, row, onClose, onSaved }: {
  branchId: string
  row: LayananRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(
    row
      ? { nama: row.nama, kategori: row.kategori, jumlah_sesi: row.jumlah_sesi != null ? String(row.jumlah_sesi) : '', harga: String(row.harga) }
      : BLANK,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.nama.trim()) { setError('Nama wajib diisi'); return }
    const payload = {
      nama: form.nama.trim(),
      kategori: form.kategori,
      jumlah_sesi: form.jumlah_sesi ? Number(form.jumlah_sesi) : null,
      harga: Number(form.harga.replace(/\./g, '')) || 0,
    }
    setSaving(true)
    const { error } = row
      ? await updateLayanan(row.id, payload)
      : await upsertLayanan({ id: crypto.randomUUID(), branch_id: branchId, is_active: true, ...payload })
    setSaving(false)
    if (error) { setError(error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-foreground mb-4">{row ? 'Ubah Layanan' : 'Tambah Layanan'}</h2>
        <form onSubmit={submit} className="space-y-3">
          <input value={form.nama} onChange={set('nama')} placeholder="Nama layanan" className={inputCls} />
          <select value={form.kategori} onChange={set('kategori')} className={inputCls}>
            {KATEGORI_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="1" value={form.jumlah_sesi} onChange={set('jumlah_sesi')} placeholder="Jumlah sesi" className={inputCls} />
            <input value={form.harga} onChange={set('harga')} placeholder="Harga (Rp)" className={inputCls} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
