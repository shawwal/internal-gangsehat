'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Coins, Gift, History, Pencil, Search, Star, TrendingDown, Users } from 'lucide-react'
import {
  fetchRewardBalances,
  getRewardSettings,
  setRewardSettings,
  type RewardBalanceRow,
  type RewardStats,
} from '@/app/actions/rewards'
import { Pagination } from '@/components/leave/Pagination'
import { RowsSkeleton } from '@/components/ui/Skeleton'
import { RewardLedgerDialog } from '@/components/rewards/RewardLedgerDialog'
import { NoticeBanner, RewardStatCard, type Notice } from '@/components/rewards/ui'

const PAGE_SIZE = 15

export default function RewardPointsPage() {
  const [rows, setRows]       = useState<RewardBalanceRow[]>([])
  const [total, setTotal]     = useState(0)
  const [stats, setStats]     = useState<RewardStats>({ outstanding: 0, patientsWithPoints: 0, redemptionsThisMonth: 0, pointsRedeemedThisMonth: 0 })
  const [search, setSearch]   = useState('')
  const [onlyWithPoints, setOnlyWithPoints] = useState(true)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice]   = useState<Notice | null>(null)
  const [ledgerFor, setLedgerFor] = useState<RewardBalanceRow | null>(null)
  const [rate, setRate]           = useState<number | null>(null)
  const [canEdit, setCanEdit]     = useState(false)
  const [rateDraft, setRateDraft] = useState<string | null>(null)
  const [savingRate, setSavingRate] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchRewardBalances({ search, page, onlyWithPoints })
    setLoading(false)
    if (res.error) { setNotice({ kind: 'error', text: res.error }); return }
    setRows(res.rows)
    setTotal(res.total)
    setStats(res.stats)
  }, [search, page, onlyWithPoints])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (searchRef.current) clearTimeout(searchRef.current) }, [])
  useEffect(() => {
    getRewardSettings().then(res => {
      if (res.error) return
      setRate(res.pointsPerReferral)
      setCanEdit(res.canEdit)
    })
  }, [])

  function handleSearch(value: string) {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => { setSearch(value); setPage(1) }, 400)
  }

  async function saveRate() {
    if (rateDraft === null) return
    setSavingRate(true)
    const next = Number(rateDraft)
    const { error } = await setRewardSettings(next)
    setSavingRate(false)
    if (error) { setNotice({ kind: 'error', text: error }); return }
    setRate(next)
    setRateDraft(null)
    setNotice({ kind: 'success', text: `Poin per referral diubah ke ${next}. Berlaku untuk pembayaran yang dikonfirmasi berikutnya.` })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Coins size={20} className="text-primary" />
            Poin Hadiah
          </h1>
          <p className="text-sm text-muted-foreground">
            Pasien mendapat poin saat teman yang mendaftar dengan kode referral mereka (gangsehat.com/daftar)
            menyelesaikan pembayaran pertama. Poin ditukar dengan hadiah di halaman Tukar Hadiah.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Star size={14} className="text-primary" />
            <span className="text-muted-foreground">Poin per referral:</span>
            {rateDraft === null ? (
              canEdit ? (
                <button
                  onClick={() => setRateDraft(String(rate ?? 5))}
                  disabled={rate === null}
                  className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary disabled:opacity-60"
                  title="Ubah poin per referral"
                >
                  {rate ?? '…'} <Pencil size={12} />
                </button>
              ) : (
                <span className="font-semibold text-foreground">{rate ?? '…'}</span>
              )
            ) : (
              <>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={rateDraft}
                  onChange={e => setRateDraft(e.target.value)}
                  className="w-20 px-2 py-1 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
                <button
                  onClick={saveRate}
                  disabled={savingRate || rateDraft.trim() === ''}
                  className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
                >
                  {savingRate ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  onClick={() => setRateDraft(null)}
                  disabled={savingRate}
                  className="px-3 py-1 rounded-lg border border-border text-xs font-medium hover:bg-muted"
                >
                  Batal
                </button>
              </>
            )}
          </div>
        </div>
        <Link
          href="/rewards/redeem"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Gift size={16} /> Tukar Hadiah
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RewardStatCard label="Poin beredar" value={stats.outstanding}
          icon={<Coins size={18} className="text-primary" />} color="bg-primary/10" />
        <RewardStatCard label="Pasien punya poin" value={stats.patientsWithPoints}
          icon={<Users size={18} className="text-foreground" />} color="bg-muted" />
        <RewardStatCard label="Penukaran bulan ini" value={stats.redemptionsThisMonth}
          icon={<Gift size={18} className="text-chart-4" />} color="bg-chart-4/15" />
        <RewardStatCard label="Poin ditukar bulan ini" value={stats.pointsRedeemedThisMonth}
          icon={<TrendingDown size={18} className="text-secondary-foreground" />} color="bg-secondary/20" />
      </div>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari nama, No. RM, atau kode referral..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-2">
          {[true, false].map(v => (
            <button
              key={String(v)}
              onClick={() => { setOnlyWithPoints(v); setPage(1) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                onlyWithPoints === v ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {v ? 'Punya poin' : 'Semua riwayat'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <RowsSkeleton rows={6} cols={6} />
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {search ? 'Tidak ada pasien yang cocok.' : 'Belum ada pasien dengan poin hadiah.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Pasien</th>
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium text-right">Referral</th>
                  <th className="px-4 py-3 font-medium text-right">Diperoleh</th>
                  <th className="px-4 py-3 font-medium text-right">Ditukar</th>
                  <th className="px-4 py-3 font-medium text-right">Saldo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(r => (
                  <tr key={r.patientId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.name}</p>
                      {r.noRm && <p className="text-xs text-muted-foreground font-mono">{r.noRm}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.referralCode ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.referralCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.earned}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.spent}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-primary">{r.balance}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setLedgerFor(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <History size={12} /> Riwayat
                        </button>
                        {r.balance > 0 && (
                          <Link
                            href={`/rewards/redeem?patient=${r.patientId}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
                          >
                            <Gift size={12} /> Tukar
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {ledgerFor && (
        <RewardLedgerDialog
          patient={ledgerFor}
          canAdjust={canEdit}
          onClose={() => setLedgerFor(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
