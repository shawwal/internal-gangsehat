'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSportMassageSettings } from '@/hooks/useSportMassageSettings'
import { useGriyaSettings } from '@/hooks/useGriyaSettings'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { fetchSportMassageLayanan, updateLayananHarga, upsertLayanan, type LayananRow } from '@/app/actions/layanan'

interface BranchOption { id: string; name: string }

export default function BranchSettingsPage() {
  const [role, setRole]                 = useState<'director' | 'manager' | null>(null)
  const [myBranchId, setMyBranchId]     = useState<string | null>(null)
  const [branches, setBranches]         = useState<BranchOption[]>([])
  const [initLoading, setInitLoading]   = useState(true)

  // Sport massage service types per branch — key: branch_id
  const [prices, setPrices]           = useState<Record<string, LayananRow[]>>({})
  // Price edits keyed by layanan id
  const [priceInput, setPriceInput]   = useState<Record<string, string>>({})
  const [priceSaving, setPriceSaving] = useState<Record<string, boolean>>({})
  // New-type form per branch — key: branch_id
  const [newNama, setNewNama]         = useState<Record<string, string>>({})
  const [newHarga, setNewHarga]       = useState<Record<string, string>>({})
  const [addSaving, setAddSaving]     = useState<Record<string, boolean>>({})

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
  const { enabledMap: griyaMap, loading: griyaLoading, toggle: toggleGriya } = useGriyaSettings(branchIds)

  // Load sport massage service types for branches whose toggle is on
  useEffect(() => {
    async function loadPrices() {
      for (const b of branches) {
        if (!enabledMap[b.id]) continue
        if (prices[b.id] !== undefined) continue
        await reloadBranch(b.id)
      }
    }
    loadPrices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, enabledMap])

  async function reloadBranch(branchId: string) {
    const rows = await fetchSportMassageLayanan(branchId)
    setPrices(prev => ({ ...prev, [branchId]: rows }))
    setPriceInput(prev => {
      const next = { ...prev }
      for (const r of rows) next[r.id] = String(r.harga)
      return next
    })
  }

  function parseHarga(raw: string | undefined) {
    return Number((raw ?? '').replace(/[^\d]/g, ''))
  }

  async function savePrice(branchId: string, row: LayananRow) {
    const harga = parseHarga(priceInput[row.id])
    if (!harga || harga <= 0) return
    setPriceSaving(prev => ({ ...prev, [row.id]: true }))
    const { error } = await updateLayananHarga(row.id, harga)
    if (error) console.error('[branch-settings] savePrice error:', error)
    else await reloadBranch(branchId)
    setPriceSaving(prev => ({ ...prev, [row.id]: false }))
  }

  async function addType(branchId: string) {
    const nama = (newNama[branchId] ?? '').trim()
    const harga = parseHarga(newHarga[branchId])
    if (!nama || !harga || harga <= 0) return
    setAddSaving(prev => ({ ...prev, [branchId]: true }))
    const { error } = await upsertLayanan({
      id: crypto.randomUUID(),
      branch_id: branchId,
      nama,
      kategori: 'SPORT MASSAGE',
      jumlah_sesi: null,
      harga,
      is_active: true,
    })
    if (error) {
      console.error('[branch-settings] addType error:', error)
    } else {
      setNewNama(prev => ({ ...prev, [branchId]: '' }))
      setNewHarga(prev => ({ ...prev, [branchId]: '' }))
      await reloadBranch(branchId)
    }
    setAddSaving(prev => ({ ...prev, [branchId]: false }))
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
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <label className="block text-xs font-medium text-muted-foreground">Jenis &amp; Tarif Sport Massage (Rp)</label>
                    {prices[b.id] === undefined ? (
                      <p className="text-xs text-muted-foreground">Memuat...</p>
                    ) : prices[b.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground">Belum ada jenis layanan. Tambahkan di bawah.</p>
                    ) : (
                      <div className="space-y-2">
                        {prices[b.id].map(row => {
                          const dirty = parseHarga(priceInput[row.id]) !== Number(row.harga)
                          return (
                            <div key={row.id} className="flex items-center gap-2">
                              <span className="flex-1 min-w-0 text-sm text-foreground truncate" title={row.nama}>{row.nama}</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                aria-label={`Tarif ${row.nama}`}
                                value={priceInput[row.id] ?? ''}
                                onChange={e => setPriceInput(prev => ({ ...prev, [row.id]: e.target.value }))}
                                className="w-28 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              <button
                                onClick={() => savePrice(b.id, row)}
                                disabled={!dirty || priceSaving[row.id]}
                                className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
                              >
                                {priceSaving[row.id] ? '...' : 'Simpan'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <input
                        type="text"
                        value={newNama[b.id] ?? ''}
                        onChange={e => setNewNama(prev => ({ ...prev, [b.id]: e.target.value }))}
                        placeholder="Jenis baru, mis. Sport Massage 90 menit"
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newHarga[b.id] ?? ''}
                        onChange={e => setNewHarga(prev => ({ ...prev, [b.id]: e.target.value }))}
                        placeholder="Tarif"
                        className="w-28 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        onClick={() => addType(b.id)}
                        disabled={addSaving[b.id] || !(newNama[b.id] ?? '').trim() || !parseHarga(newHarga[b.id])}
                        className="px-3 py-2 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors disabled:opacity-40"
                      >
                        {addSaving[b.id] ? '...' : 'Tambah'}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Nonaktifkan atau hapus jenis layanan di menu Layanan.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="pt-2">
        <h2 className="text-base font-semibold text-foreground">Fitur Griya Anak</h2>
        <p className="text-sm text-muted-foreground">Aktifkan jadwal mingguan, paket &amp; tarif, dan toko untuk cabang Griya Anak</p>
      </div>

      {griyaLoading ? (
        <div className="text-sm text-muted-foreground">Memuat pengaturan...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map(b => (
            <div key={b.id} className="glass-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-foreground">{b.name}</div>
                  <div className="text-xs text-muted-foreground">Fitur Griya Anak</div>
                </div>
                <ToggleSwitch
                  checked={griyaMap[b.id] ?? false}
                  onClick={() => toggleGriya(b.id, !(griyaMap[b.id] ?? false))}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
