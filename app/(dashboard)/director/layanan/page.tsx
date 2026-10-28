'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchLayananByBranch,
  updateLayananHarga,
  toggleLayananActive,
  setLayananOnlineServiceType,
  upsertLayanan,
  deleteLayanan,
  fetchPayrollActivityOptions,
  fetchLayananKategori,
  createLayananKategori,
  type LayananKategori,
  type LayananRow,
  type PfotmLayananMetric,
} from '@/app/actions/layanan'
import { RowsSkeleton } from '@/components/ui/Skeleton'
import { useProfile } from '@/hooks/useProfile'
import { PFOTM_METRIC_LABELS } from '@/lib/pfotm/labels'

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

interface Branch { id: string; name: string }

type SortKey = 'nama' | 'kategori' | 'harga'

const PFOTM_METRIC_LABEL: Record<PfotmLayananMetric, string> = {
  paket_1: PFOTM_METRIC_LABELS.paket_1, paket_2: PFOTM_METRIC_LABELS.paket_2, paket_3: PFOTM_METRIC_LABELS.paket_3,
  terapi_awal_sesi_visit: PFOTM_METRIC_LABELS.terapi_awal_sesi_visit, paket_visit: PFOTM_METRIC_LABELS.paket_visit,
}

interface AddForm {
  nama: string
  kategori: string
  jumlah_sesi: string
  harga: string
  deskripsi: string
  payroll_units: Record<string, number>
  pfotm_metric: PfotmLayananMetric | ''
}

const EMPTY_FORM: AddForm = { nama: '', kategori: '', jumlah_sesi: '', harga: '', deskripsi: '', payroll_units: {}, pfotm_metric: '' }

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

  // sort
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  // delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // add / edit row modal (editRow = null → add)
  const [showAdd, setShowAdd]   = useState(false)
  const [editRow, setEditRow]   = useState<LayananRow | null>(null)
  const [addForm, setAddForm]   = useState<AddForm>(EMPTY_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError]   = useState<string | null>(null)

  // kategori list (income_categories) — directors can add one from the form
  const profile = useProfile()
  const canAddKategori = profile?.role === 'director'
  const [kategoriList, setKategoriList]       = useState<LayananKategori[]>([])
  const [newKategori, setNewKategori]         = useState<string | null>(null)   // null = field hidden
  const [kategoriSaving, setKategoriSaving]   = useState(false)
  const [kategoriError, setKategoriError]     = useState<string | null>(null)
  useEffect(() => { fetchLayananKategori().then(setKategoriList) }, [])

  async function handleAddKategori() {
    if (!newKategori?.trim()) return
    setKategoriSaving(true)
    setKategoriError(null)
    const { data, error } = await createLayananKategori(newKategori)
    setKategoriSaving(false)
    if (error || !data) { setKategoriError(error); return }
    setKategoriList(await fetchLayananKategori())
    setAddForm((f) => ({ ...f, kategori: data.code }))
    setNewKategori(null)
  }

  // payroll activity columns a Layanan can count toward
  const [activityOptions, setActivityOptions] = useState<{ code: string; label: string }[]>([])
  useEffect(() => { fetchPayrollActivityOptions().then(setActivityOptions) }, [])
  const activityLabel = (code: string) => activityOptions.find((a) => a.code === code)?.label ?? code

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

  // ── Online booking (gangsehat.com) ─────────────────────────────────────────
  async function handleOnline(id: string, value: string) {
    await setLayananOnlineServiceType(id, value === 'TERAPI AWAL KLINIK' || value === 'SESI KLINIK' ? value : null)
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

  // ── Add new / edit ───────────────────────────────────────────────────────────
  function openAdd() {
    setEditRow(null)
    setAddForm({ ...EMPTY_FORM, kategori: kategoriList[0]?.code ?? '' })
    setAddError(null)
    setNewKategori(null)
    setKategoriError(null)
    setShowAdd(true)
  }

  function openEdit(row: LayananRow) {
    setEditRow(row)
    setAddForm({
      nama:        row.nama,
      kategori:    row.kategori,
      jumlah_sesi: row.jumlah_sesi != null ? String(row.jumlah_sesi) : '',
      harga:       String(row.harga),
      deskripsi:   row.deskripsi ?? '',
      payroll_units: row.payroll_units ?? {},
      pfotm_metric:  row.pfotm_metric ?? '',
    })
    setAddError(null)
    setNewKategori(null)
    setKategoriError(null)
    setShowAdd(true)
  }

  async function handleAdd() {
    if (!selectedBranch || !addForm.nama.trim()) {
      setAddError('Nama wajib diisi.')
      return
    }
    if (!addForm.kategori) {
      setAddError('Kategori wajib dipilih.')
      return
    }
    setAddSaving(true)
    setAddError(null)
    const { error } = await upsertLayanan({
      id:          editRow?.id ?? crypto.randomUUID(),
      branch_id:   editRow?.branch_id ?? selectedBranch,
      nama:        addForm.nama.trim(),
      kategori:    addForm.kategori,
      jumlah_sesi: addForm.jumlah_sesi ? Number(addForm.jumlah_sesi) : null,
      harga:       Number(addForm.harga) || 0,
      deskripsi:   addForm.deskripsi.trim() || null,
      payroll_units: Object.fromEntries(Object.entries(addForm.payroll_units).filter(([, n]) => n > 0)),
      pfotm_metric:  addForm.pfotm_metric || null,
      is_active:   editRow?.is_active ?? true,
    })
    setAddSaving(false)
    if (error) { setAddError(error); return }
    setShowAdd(false)
    setEditRow(null)
    reload()
  }

  const activeBranch = branches.find((b) => b.id === selectedBranch)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const cmp = sortKey === 'harga'
          ? a.harga - b.harga
          : a[sortKey].localeCompare(b[sortKey], 'id') || a.nama.localeCompare(b.nama, 'id')
        return sortAsc ? cmp : -cmp
      })
    : rows

  function sortHeader(k: SortKey, label: string, align: 'left' | 'right') {
    const Icon = sortKey !== k ? ArrowUpDown : sortAsc ? ArrowUp : ArrowDown
    return (
      <th className={`text-${align} px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide`}>
        <button
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground transition-colors cursor-pointer ${sortKey === k ? 'text-foreground' : ''}`}
        >
          {label}
          <Icon size={12} className={sortKey === k ? '' : 'opacity-50'} />
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tarif Layanan</h1>
          <p className="text-sm text-muted-foreground">
            Atur harga per jenis layanan untuk setiap cabang, dan kolom penggajian / PFOTM yang dihitung darinya
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {branches.length > 1 && (
            <select
              value={selectedBranch ?? ''}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="flex-1 min-w-0 sm:flex-none sm:max-w-xs px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
          >
            <Plus size={15} /> Tambah Layanan
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <RowsSkeleton rows={8} cols={6} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <p className="text-sm">Belum ada layanan untuk {activeBranch?.name ?? 'cabang ini'}.</p>
            <button
              onClick={openAdd}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              + Tambah sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  {sortHeader('nama', 'Nama', 'left')}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deskripsi</th>
                  {sortHeader('kategori', 'Kategori', 'left')}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sesi</th>
                  {sortHeader('harga', 'Harga (Rp)', 'right')}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide" title="Bisa dipesan & dibayar pasien di gangsehat.com">Booking Online</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aktif</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedRows.map((row) => (
                  <tr key={row.id} className={`transition-colors ${row.is_active ? 'hover:bg-muted/10' : 'opacity-50 hover:bg-muted/10'}`}>
                    {/* Nama */}
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.nama}
                      {(Object.keys(row.payroll_units ?? {}).length > 0 || row.pfotm_metric) && (
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {Object.entries(row.payroll_units ?? {}).map(([c, n]) => `${activityLabel(c)}${n > 1 ? ` ×${n}` : ''}`).join(', ')}
                          {Object.keys(row.payroll_units ?? {}).length > 0 && row.pfotm_metric && ' · '}
                          {row.pfotm_metric && `PFOTM: ${PFOTM_METRIC_LABEL[row.pfotm_metric]}`}
                        </div>
                      )}
                    </td>

                    {/* Deskripsi — table is nowrap, so long text truncates (full text on hover / in Edit) */}
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="max-w-[16rem] truncate" title={row.deskripsi ?? undefined}>
                        {row.deskripsi || '—'}
                      </div>
                    </td>

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

                    {/* Online booking: which visit type a gangsehat.com booking creates */}
                    <td className="px-4 py-3 text-center">
                      {row.kategori.toUpperCase().includes('PAKET') ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <select
                          value={row.online_service_type ?? ''}
                          onChange={(e) => handleOnline(row.id, e.target.value)}
                          className="px-2 py-1 border border-border rounded-lg text-xs bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label={`Booking online untuk ${row.nama}`}
                        >
                          <option value="">Tidak</option>
                          <option value="TERAPI AWAL KLINIK">Terapi Awal Klinik</option>
                          <option value="SESI KLINIK">Sesi Klinik</option>
                        </select>
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

                    {/* Edit / Delete */}
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
                        <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          title="Edit layanan"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(row.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Hapus layanan"
                        >
                          <Trash2 size={14} />
                        </button>
                        </div>
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
              className="glass-card w-full max-w-md shadow-2xl max-h-[90dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h2 className="text-base font-semibold">{editRow ? 'Edit Layanan' : 'Tambah Layanan'}</h2>
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
                      {kategoriList.map((k) => <option key={k.code} value={k.code}>{k.code}</option>)}
                      {addForm.kategori && !kategoriList.some((k) => k.code === addForm.kategori) && (
                        <option value={addForm.kategori}>{addForm.kategori}</option>
                      )}
                    </select>
                    {canAddKategori && newKategori === null && (
                      <button
                        type="button"
                        onClick={() => { setNewKategori(''); setKategoriError(null) }}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        <Plus size={11} /> Kategori baru
                      </button>
                    )}
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

                {newKategori !== null && (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <label className="block text-xs font-medium">Kategori baru</label>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newKategori}
                        onChange={(e) => setNewKategori(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleAddKategori() }
                          if (e.key === 'Escape') setNewKategori(null)
                        }}
                        placeholder="mis. Terapi Wicara"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={handleAddKategori}
                        disabled={kategoriSaving || !newKategori.trim()}
                        className="px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer shrink-0"
                      >
                        {kategoriSaving ? <Loader2 size={13} className="animate-spin" /> : 'Tambah'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewKategori(null)}
                        className="p-2 rounded-xl hover:bg-muted transition-colors cursor-pointer text-muted-foreground shrink-0"
                        aria-label="Batal tambah kategori"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {newKategori.trim()
                        ? <>Disimpan sebagai <span className="font-semibold text-foreground">{newKategori.trim().replace(/\s+/g, ' ').toUpperCase()}</span> — berlaku untuk semua cabang.</>
                        : 'Berlaku untuk semua cabang dan langsung bisa dipakai untuk pembayaran.'}
                    </p>
                    {kategoriError && (
                      <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{kategoriError}</p>
                    )}
                  </div>
                )}

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

                <div>
                  <label className="block text-xs font-medium mb-1.5">Deskripsi <span className="text-muted-foreground font-normal">(opsional)</span></label>
                  <textarea
                    rows={3}
                    value={addForm.deskripsi}
                    onChange={(e) => setAddForm((f) => ({ ...f, deskripsi: e.target.value }))}
                    placeholder="mis. 10 sesi terapi, berlaku 3 bulan"
                    className={inputCls + ' resize-y'}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div>
                    <p className="text-xs font-medium">Dihitung untuk</p>
                    <p className="text-[11px] text-muted-foreground">
                      Kosongkan jika cabang ini masih memakai hitungan lama. Kolom gaji dihitung dari pembayaran LUNAS / PELUNASAN dengan layanan ini.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Penggajian <span className="text-muted-foreground font-normal">(jumlah per pembayaran)</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {activityOptions.map((a) => (
                        <label key={a.code} className="flex items-center gap-2 text-xs">
                          <input
                            type="number"
                            min="0"
                            value={addForm.payroll_units[a.code] ?? ''}
                            onChange={(e) => setAddForm((f) => ({
                              ...f,
                              payroll_units: { ...f.payroll_units, [a.code]: Math.max(0, Math.round(Number(e.target.value) || 0)) },
                            }))}
                            placeholder="0"
                            className="w-14 px-2 py-1 border border-border rounded-lg text-xs bg-input text-center focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <span className="truncate" title={a.label}>{a.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Kolom PFOTM</label>
                    <select
                      value={addForm.pfotm_metric}
                      onChange={(e) => setAddForm((f) => ({ ...f, pfotm_metric: e.target.value as AddForm['pfotm_metric'] }))}
                      className={inputCls + ' cursor-pointer'}
                    >
                      <option value="">Tidak dihitung</option>
                      {Object.entries(PFOTM_METRIC_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
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
