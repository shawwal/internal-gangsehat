'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSportMassageSettings } from '@/hooks/useSportMassageSettings'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { fetchLayananByBranch, upsertLayanan, type LayananRow } from '@/app/actions/layanan'

interface BranchOption { id: string; name: string }

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

export default function BranchSettingsPage() {
  const [role, setRole]                 = useState<'director' | 'manager' | null>(null)
  const [myBranchId, setMyBranchId]     = useState<string | null>(null)
  const [branches, setBranches]         = useState<BranchOption[]>([])
  const [initLoading, setInitLoading]   = useState(true)

  // Sport massage price per branch — key: branch_id
  const [prices, setPrices]     = useState<Record<string, LayananRow | null>>({})
  const [priceInput, setPriceInput] = useState<Record<string, string>>({})
  const [priceSaving, setPriceSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setInitLoading(false); return }

      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('role, branch_id')
        .eq('id', user.id)
        .single()

      if (!profile) { setInitLoading(false); return }
      setRole(profile.role as 'director' | 'manager')
      setMyBranchId(profile.branch_id ?? null)

      let branchQuery = supabase.from('branches').select('id, name').eq('is_active', true).order('name')
      if (profile.role === 'manager' && profile.branch_id) {
        branchQuery = branchQuery.eq('id', profile.branch_id)
      }
      const { data: branchData } = await branchQuery
      setBranches((branchData ?? []) as BranchOption[])
      setInitLoading(false)
    }
    init()
  }, [])

  const branchIds = useMemo(() => branches.map(b => b.id), [branches])
  const { enabledMap, loading: settingsLoading, toggle } = useSportMassageSettings(branchIds)

  // Load sport massage layanan price for branches whose toggle is on
  useEffect(() => {
    async function loadPrices() {
      for (const b of branches) {
        if (!enabledMap[b.id]) continue
        if (prices[b.id] !== undefined) continue
        const rows = await fetchLayananByBranch(b.id)
        const row = rows.find(r => r.kategori === 'SPORT MASSAGE') ?? null
        setPrices(prev => ({ ...prev, [b.id]: row }))
        setPriceInput(prev => ({ ...prev, [b.id]: row ? String(row.harga) : '' }))
      }
    }
    loadPrices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, enabledMap])

  async function savePrice(branchId: string) {
    const raw = priceInput[branchId] ?? ''
    const harga = Number(raw.replace(/[^\d]/g, ''))
    if (!harga || harga <= 0) return
    setPriceSaving(prev => ({ ...prev, [branchId]: true }))
    const existing = prices[branchId]
    const { error } = await upsertLayanan({
      id: existing?.id ?? crypto.randomUUID(),
      branch_id: branchId,
      nama: 'Sport Massage',
      kategori: 'SPORT MASSAGE',
      jumlah_sesi: null,
      harga,
      is_active: true,
    })
    if (!error) {
      const rows = await fetchLayananByBranch(branchId)
      const row = rows.find(r => r.kategori === 'SPORT MASSAGE') ?? null
      setPrices(prev => ({ ...prev, [branchId]: row }))
    } else {
      console.error('[branch-settings] savePrice error:', error)
    }
    setPriceSaving(prev => ({ ...prev, [branchId]: false }))
  }

  async function handleToggle(branchId: string) {
    const next = !(enabledMap[branchId] ?? false)
    await toggle(branchId, next)
  }

  if (initLoading) {
    return <div className="text-sm text-muted-foreground">Memuat...</div>
  }

  if (role !== 'director' && role !== 'manager') {
    return <div className="text-sm text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pengaturan Cabang</h1>
        <p className="text-sm text-muted-foreground">Aktifkan atau nonaktifkan layanan Sport Massage per cabang</p>
      </div>

      {settingsLoading ? (
        <div className="text-sm text-muted-foreground">Memuat pengaturan...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map(b => {
            const isEnabled = enabledMap[b.id] ?? false
            return (
              <div key={b.id} className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-foreground">{b.name}</div>
                    <div className="text-xs text-muted-foreground">Sport Massage</div>
                  </div>
                  <ToggleSwitch checked={isEnabled} onClick={() => handleToggle(b.id)} />
                </div>

                {isEnabled && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <label className="block text-xs font-medium text-muted-foreground">Tarif Sport Massage (Rp)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={priceInput[b.id] ?? ''}
                        onChange={e => setPriceInput(prev => ({ ...prev, [b.id]: e.target.value }))}
                        placeholder="mis. 150000"
                        className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        onClick={() => savePrice(b.id)}
                        disabled={priceSaving[b.id]}
                        className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        {priceSaving[b.id] ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                    {prices[b.id] && (
                      <p className="text-xs text-muted-foreground">Tarif saat ini: Rp {fmt(prices[b.id]!.harga)}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
