'use client'

import { useEffect, useState } from 'react'
import { Package, AlertTriangle } from 'lucide-react'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

interface Props {
  branchId: string | null
  selected: LayananRow | null
  onSelect: (layanan: LayananRow) => void
}

export function LayananPicker({ branchId, selected, onSelect }: Props) {
  const [rows, setRows]       = useState<LayananRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!branchId) { setRows([]); return }
    setLoading(true)
    fetchLayananByBranch(branchId).then((data) => {
      setRows(data.filter((r) => r.kategori === 'PAKET KLINIK' && r.is_active))
      setLoading(false)
    })
  }, [branchId])

  if (!branchId) {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">Terapis tidak memiliki branch. Hubungi HR.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Belum ada paket klinik di daftar layanan cabang ini.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const isSelected = selected?.id === row.id
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row)}
            className={[
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer',
              isSelected
                ? 'bg-primary/10 border-primary/40'
                : 'border-border/40 hover:bg-white/5 hover:border-border',
            ].join(' ')}
          >
            <div className={[
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              isSelected ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground',
            ].join(' ')}>
              <Package size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{row.nama}</p>
              <p className="text-xs text-muted-foreground">
                {row.jumlah_sesi ?? '—'} sesi · Rp {fmt(row.harga)}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
