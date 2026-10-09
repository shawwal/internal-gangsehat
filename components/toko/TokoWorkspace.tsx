'use client'

import { useState } from 'react'
import { ShoppingCart, Package, History } from 'lucide-react'
import { KasirTab } from './KasirTab'
import { ProdukTab } from './ProdukTab'
import { RiwayatTab } from './RiwayatTab'

/** Which shop is rendering — only changes labels (e.g. "anak" vs "pasien"). */
export type TokoVariant = 'griya' | 'fisio'

type Tab = 'kasir' | 'produk' | 'riwayat'
const TABS: { key: Tab; label: string; icon: typeof Package }[] = [
  { key: 'kasir', label: 'Kasir', icon: ShoppingCart },
  { key: 'produk', label: 'Produk', icon: Package },
  { key: 'riwayat', label: 'Riwayat', icon: History },
]

export function TokoSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-muted" />
      <div className="h-10 w-full rounded-xl bg-muted" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted" />)}
      </div>
    </div>
  )
}

/** Kasir / Produk / Riwayat tabs, shared by Toko Griya Anak and the fisioterapi Toko. */
export function TokoWorkspace({ branchId, variant, title, headerExtra }: {
  branchId: string
  variant: TokoVariant
  title: string
  headerExtra?: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('kasir')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Penjualan barang — tunai, transfer, EDC, atau online (QRIS/VA). Setiap transaksi tercatat sebagai pemasukan (kategori TOKO).
          </p>
        </div>
        {headerExtra}
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* key: switching branch (director) remounts the tabs with fresh data */}
      <div key={branchId}>
        {tab === 'kasir' && <KasirTab branchId={branchId} variant={variant} />}
        {tab === 'produk' && <ProdukTab branchId={branchId} />}
        {tab === 'riwayat' && <RiwayatTab branchId={branchId} />}
      </div>
    </div>
  )
}
