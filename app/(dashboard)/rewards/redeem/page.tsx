'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Coins, Gift, PackageOpen, Undo2 } from 'lucide-react'
import {
  cancelRedemption,
  fetchRedeemablePatients,
  fetchRedemptions,
  listRewardItems,
  type RewardBalanceRow,
  type RewardItem,
  type RewardRedemptionRow,
} from '@/app/actions/rewards'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { CardGridSkeleton, RowsSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/leave/Pagination'
import { formatDateTime } from '@/components/patient-registrations/types'
import { RewardItemCard } from '@/components/rewards/RewardItemCard'
import { RedeemConfirmDialog } from '@/components/rewards/RedeemConfirmDialog'
import { NoticeBanner, type Notice } from '@/components/rewards/ui'

const PAGE_SIZE = 15

function RedeemContent() {
  const searchParams = useSearchParams()
  const [patients, setPatients]   = useState<RewardBalanceRow[] | null>(null)
  const [patientId, setPatientId] = useState(searchParams.get('patient') ?? '')
  const [items, setItems]         = useState<RewardItem[] | null>(null)
  const [redemptions, setRedemptions] = useState<RewardRedemptionRow[]>([])
  const [redTotal, setRedTotal]   = useState(0)
  const [redPage, setRedPage]     = useState(1)
  const [onlyPatient, setOnlyPatient] = useState(false)
  const [redLoading, setRedLoading]   = useState(true)
  const [notice, setNotice]       = useState<Notice | null>(null)
  const [redeeming, setRedeeming] = useState<RewardItem | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const loadPatients = useCallback(async () => {
    const res = await fetchRedeemablePatients()
    if (res.error) { setNotice({ kind: 'error', text: res.error }); setPatients([]); return }
    setPatients(res.rows)
  }, [])

  const loadItems = useCallback(async () => {
    const res = await listRewardItems({ activeOnly: true })
    if (res.error) { setNotice({ kind: 'error', text: res.error }); setItems([]); return }
    setItems(res.items)
  }, [])

  const loadRedemptions = useCallback(async () => {
    setRedLoading(true)
    const res = await fetchRedemptions({ page: redPage, patientId: onlyPatient && patientId ? patientId : null })
    setRedLoading(false)
    if (res.error) { setNotice({ kind: 'error', text: res.error }); return }
    setRedemptions(res.rows)
    setRedTotal(res.total)
  }, [redPage, onlyPatient, patientId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPatients(); loadItems() }, [loadPatients, loadItems])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRedemptions() }, [loadRedemptions])

  const patient = useMemo(
    () => patients?.find(p => p.patientId === patientId) ?? null,
    [patients, patientId],
  )

  const options = useMemo(() => patients?.map(p => ({
    value: p.patientId,
    label: [p.name, p.noRm, p.referralCode].filter(Boolean).join(' · '),
    hint: `${p.balance} poin`,
  })) ?? null, [patients])

  async function refreshAll() {
    await Promise.all([loadPatients(), loadItems(), loadRedemptions()])
  }

  async function handleCancel(r: RewardRedemptionRow) {
    if (!confirm(`Batalkan penukaran "${r.itemName}" untuk ${r.patientName}? Poin (${r.totalPoints}) dan stok akan dikembalikan.`)) return
    setCancellingId(r.id)
    const { error } = await cancelRedemption(r.id)
    setCancellingId(null)
    setNotice(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Penukaran dibatalkan, poin dikembalikan.' })
    await refreshAll()
  }

  const selectedButEmpty = patientId && patients !== null && !patient

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Gift size={20} className="text-primary" />
          Tukar Hadiah
        </h1>
        <p className="text-sm text-muted-foreground">
          Pilih pasien, lalu pilih hadiah. Poin dipotong otomatis dan stok berkurang. Penukaran bisa dibatalkan untuk mengembalikan poin.
        </p>
      </div>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <div className="glass-card p-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Pasien</p>
          <SearchSelect
            options={options}
            value={patientId}
            onChange={(v) => { setPatientId(v); setRedPage(1) }}
            placeholder={patients?.length === 0 ? 'Belum ada pasien dengan poin' : 'Pilih pasien yang punya poin…'}
            searchPlaceholder="Cari nama, No. RM, atau kode…"
            ariaLabel="Pilih pasien"
          />
          {selectedButEmpty && (
            <p className="text-xs text-muted-foreground">Pasien ini tidak memiliki saldo poin.</p>
          )}
        </div>
        {patient && (
          <div className="flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-3">
            <Coins size={20} className="text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold leading-none text-primary tabular-nums">{patient.balance}</p>
              <p className="text-xs text-muted-foreground mt-1">poin tersedia</p>
            </div>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Hadiah</h2>
          <Link href="/rewards/items" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
            <PackageOpen size={12} /> Kelola katalog
          </Link>
        </div>
        {items === null ? (
          <CardGridSkeleton />
        ) : items.length === 0 ? (
          <div className="glass-card p-10 text-center text-sm text-muted-foreground">
            Belum ada hadiah aktif. <Link href="/rewards/items" className="text-primary hover:underline">Tambah hadiah</Link>.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map(item => (
              <RewardItemCard key={item.id} item={item} balance={patient?.balance ?? null} onRedeem={setRedeeming} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Riwayat Penukaran</h2>
          {patient && (
            <div className="flex gap-2">
              {[false, true].map(v => (
                <button
                  key={String(v)}
                  onClick={() => { setOnlyPatient(v); setRedPage(1) }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    onlyPatient === v ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v ? 'Pasien ini' : 'Semua'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="glass-card overflow-hidden">
          {redLoading ? (
            <RowsSkeleton rows={4} cols={5} />
          ) : redemptions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Belum ada penukaran.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Waktu</th>
                    <th className="px-4 py-3 font-medium">Pasien</th>
                    <th className="px-4 py-3 font-medium">Hadiah</th>
                    <th className="px-4 py-3 font-medium text-right">Poin</th>
                    <th className="px-4 py-3 font-medium">Oleh</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {redemptions.map(r => {
                    const cancelled = r.status === 'cancelled'
                    return (
                      <tr key={r.id} className={cancelled ? 'opacity-60' : ''}>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{r.patientName}</p>
                          {r.patientNoRm && <p className="text-xs text-muted-foreground font-mono">{r.patientNoRm}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className={cancelled ? 'line-through' : ''}>{r.itemName}{r.quantity > 1 && ` ×${r.quantity}`}</p>
                          {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                          {cancelled && (
                            <p className="text-xs text-destructive">
                              Dibatalkan{r.cancelledByName && ` oleh ${r.cancelledByName}`}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-destructive">−{r.totalPoints}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {r.redeemedByName ?? '—'}
                          {r.branchName && <span className="block">{r.branchName}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!cancelled && (
                            <button
                              onClick={() => handleCancel(r)}
                              disabled={cancellingId === r.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                            >
                              <Undo2 size={12} /> Batalkan
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Pagination page={redPage} pageSize={PAGE_SIZE} total={redTotal} onPage={setRedPage} />
      </section>

      {redeeming && patient && (
        <RedeemConfirmDialog
          patient={patient}
          item={redeeming}
          onClose={() => setRedeeming(null)}
          onRedeemed={async (text) => {
            setRedeeming(null)
            setNotice({ kind: 'success', text })
            await refreshAll()
          }}
        />
      )}
    </div>
  )
}

export default function RedeemRewardPage() {
  return (
    <Suspense>
      <RedeemContent />
    </Suspense>
  )
}
