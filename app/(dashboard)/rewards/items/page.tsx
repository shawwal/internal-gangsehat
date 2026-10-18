'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gift, PackageOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteRewardItem,
  listRewardItems,
  setRewardItemActive,
  type RewardItem,
} from '@/app/actions/rewards'
import { RowsSkeleton } from '@/components/ui/Skeleton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { RewardItemModal } from '@/components/rewards/RewardItemModal'
import { NoticeBanner, type Notice } from '@/components/rewards/ui'

export default function RewardCatalogPage() {
  const [items, setItems]     = useState<RewardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice]   = useState<Notice | null>(null)
  const [editing, setEditing] = useState<RewardItem | null | 'new'>(null)
  const [busyId, setBusyId]   = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await listRewardItems()
    setLoading(false)
    if (res.error) { setNotice({ kind: 'error', text: res.error }); return }
    setItems(res.items)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function toggle(item: RewardItem) {
    setBusyId(item.id)
    const { error } = await setRewardItemActive(item.id, !item.isActive)
    setBusyId(null)
    if (error) { setNotice({ kind: 'error', text: error }); return }
    await load()
  }

  async function remove(item: RewardItem) {
    if (!confirm(`Hapus hadiah "${item.name}"?`)) return
    setBusyId(item.id)
    const { error } = await deleteRewardItem(item.id)
    setBusyId(null)
    setNotice(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Hadiah dihapus.' })
    await load()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <PackageOpen size={20} className="text-primary" />
            Katalog Hadiah
          </h1>
          <p className="text-sm text-muted-foreground">
            Daftar hadiah yang bisa ditukar dengan poin hadiah pasien. Hadiah aktif juga tampil di dashboard pasien.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus size={16} /> Tambah Hadiah
        </button>
      </div>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <div className="glass-card overflow-hidden">
        {loading ? (
          <RowsSkeleton rows={5} cols={5} />
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Gift size={28} className="mx-auto text-muted-foreground/60" />
            <p className="mt-2 text-sm text-muted-foreground">Belum ada hadiah. Tambahkan hadiah pertama.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Hadiah</th>
                  <th className="px-4 py-3 font-medium text-right">Harga</th>
                  <th className="px-4 py-3 font-medium text-right">Stok</th>
                  <th className="px-4 py-3 font-medium text-right">Ditukar</th>
                  <th className="px-4 py-3 font-medium">Aktif</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(item => (
                  <tr key={item.id} className={`hover:bg-muted/40 transition-colors ${item.isActive ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {item.imageUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            : <Gift size={16} className="text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{item.name}</p>
                          {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">{item.pointsCost} poin</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${item.stock === 0 ? 'text-destructive font-medium' : ''}`}>
                      {item.stock ?? '∞'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{item.redemptionCount}</td>
                    <td className="px-4 py-3">
                      <ToggleSwitch checked={item.isActive} disabled={busyId === item.id} onClick={() => toggle(item)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(item)}
                          title="Ubah"
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => remove(item)}
                          disabled={busyId === item.id}
                          title="Hapus"
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <RewardItemModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (name) => {
            setEditing(null)
            setNotice({ kind: 'success', text: `Hadiah "${name}" disimpan.` })
            await load()
          }}
        />
      )}
    </div>
  )
}
