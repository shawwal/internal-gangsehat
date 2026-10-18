'use client'

import { Gift } from 'lucide-react'
import type { RewardItem } from '@/app/actions/rewards'

interface Props {
  item: RewardItem
  /** null = no patient picked yet */
  balance: number | null
  onRedeem: (item: RewardItem) => void
}

export function RewardItemCard({ item, balance, onRedeem }: Props) {
  const outOfStock = item.stock === 0
  const affordable = balance !== null && balance >= item.pointsCost
  const disabled = balance === null || outOfStock || !affordable
  const reason = outOfStock
    ? 'Stok habis'
    : balance === null
      ? 'Pilih pasien dulu'
      : !affordable
        ? `Kurang ${item.pointsCost - balance} poin`
        : null

  return (
    <div className={`glass-card overflow-hidden flex flex-col ${disabled ? 'opacity-70' : ''}`}>
      <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
        {item.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          : <Gift size={28} className="text-muted-foreground/60" />}
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground line-clamp-2">{item.name}</p>
        {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-primary tabular-nums">{item.pointsCost} poin</span>
          <span className="text-[11px] text-muted-foreground">
            {item.stock === null ? 'Stok ∞' : `Stok ${item.stock}`}
          </span>
        </div>
        <button
          onClick={() => onRedeem(item)}
          disabled={disabled}
          className="mt-2 w-full px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          {reason ?? 'Tukar'}
        </button>
      </div>
    </div>
  )
}
