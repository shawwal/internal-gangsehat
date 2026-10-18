'use client'

import { useState } from 'react'
import { Gift } from 'lucide-react'
import { upsertRewardItem, type RewardItem } from '@/app/actions/rewards'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ModalShell, inputCls } from './ui'

interface Props {
  /** null = create */
  item: RewardItem | null
  onClose: () => void
  onSaved: (name: string) => void
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function RewardItemModal({ item, onClose, onSaved }: Props) {
  const [name, setName]               = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [imageUrl, setImageUrl]       = useState(item?.imageUrl ?? '')
  const [pointsCost, setPointsCost]   = useState(item ? String(item.pointsCost) : '')
  const [stock, setStock]             = useState(item?.stock != null ? String(item.stock) : '')
  const [sortOrder, setSortOrder]     = useState(String(item?.sortOrder ?? 0))
  const [isActive, setIsActive]       = useState(item?.isActive ?? true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const res = await upsertRewardItem(item?.id ?? null, {
      name,
      description,
      imageUrl,
      pointsCost: Number(pointsCost),
      stock: stock.trim() === '' ? null : Number(stock),
      isActive,
      sortOrder: Number(sortOrder || 0),
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onSaved(name.trim())
  }

  return (
    <ModalShell
      onClose={onClose}
      icon={<Gift size={16} className="text-primary" />}
      title={item ? 'Ubah Hadiah' : 'Tambah Hadiah'}
      subtitle="Hadiah aktif tampil di dashboard pasien gangsehat.com dan bisa ditukar di halaman Tukar Hadiah."
      footer={
        <div className="space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
            >
              Batal
            </button>
            <button
              onClick={save}
              disabled={saving || !name.trim() || !pointsCost.trim()}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nama hadiah">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="mis. Voucher diskon 50rb" className={inputCls} autoFocus />
        </Field>
        <Field label="Deskripsi" hint="Opsional">
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Harga (poin)">
            <input type="number" min={1} step={1} value={pointsCost} onChange={e => setPointsCost(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Stok" hint="Kosongkan = tidak terbatas">
            <input type="number" min={0} step={1} value={stock} onChange={e => setStock(e.target.value)} placeholder="∞" className={inputCls} />
          </Field>
        </div>
        <Field label="URL gambar" hint="Opsional, https://…">
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Urutan" hint="Angka kecil tampil lebih dulu">
            <input type="number" step={1} value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex items-center gap-2 pb-6">
            <ToggleSwitch checked={isActive} onClick={() => setIsActive(v => !v)} />
            <span className="text-sm text-foreground">{isActive ? 'Aktif' : 'Nonaktif'}</span>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
