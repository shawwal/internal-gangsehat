'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, Package, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveGriyaBranchId } from '@/app/actions/griyaJadwal'
import { KasirTab } from '@/components/griya/toko/KasirTab'
import { ProdukTab } from '@/components/griya/toko/ProdukTab'
import { RiwayatTab } from '@/components/griya/toko/RiwayatTab'

type Tab = 'kasir' | 'produk' | 'riwayat'
const TABS: { key: Tab; label: string; icon: typeof Package }[] = [
  { key: 'kasir', label: 'Kasir', icon: ShoppingCart },
  { key: 'produk', label: 'Produk', icon: Package },
  { key: 'riwayat', label: 'Riwayat', icon: History },
]

export default function GriyaTokoPage() {
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('kasir')

  useEffect(() => {
    (async () => {
      const bid = await resolveGriyaBranchId()
      setBranchId(bid)
      if (!bid) { setEnabled(false); return }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('internal_profiles').select('role').eq('id', user!.id).single()
      const { data: s } = await supabase.from('branch_griya_settings').select('enabled').eq('branch_id', bid).maybeSingle()
      setEnabled(profile?.role === 'director' ? true : (s?.enabled ?? false))
    })()
  }, [])

  if (branchId === undefined || enabled === null) {
    return <div className="text-sm text-muted-foreground">Memuat...</div>
  }
  if (!branchId || !enabled) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Toko Griya Anak belum aktif untuk cabang ini.</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Toko Griya Anak</h1>
        <p className="text-sm text-muted-foreground">Penjualan buku &amp; barang. Setiap transaksi tercatat sebagai pemasukan (kategori TOKO).</p>
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

      {tab === 'kasir' && <KasirTab branchId={branchId} />}
      {tab === 'produk' && <ProdukTab branchId={branchId} />}
      {tab === 'riwayat' && <RiwayatTab branchId={branchId} />}
    </div>
  )
}
