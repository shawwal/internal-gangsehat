'use client'

import './pfotm-styles.css'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, LockOpen, Trophy } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  addPfotmParticipant, getPfotmBoard, getPfotmHistory, listPfotmCandidates, lockPfotmPeriod, openPfotmPeriod,
  refreshPfotmAuto, savePointRule, setPfotmExcluded, setPfotmOverride, setPfotmWorkingDays, unlockPfotmPeriod,
  type PfotmBoardData, type PfotmHistoryRow,
} from '@/app/actions/pfotm'
import { MONTH_NAMES } from '@/lib/payroll/period'
import { mergeMetrics, rankBoard } from '@/lib/pfotm/engine'
import { PfotmBoard } from '@/components/pfotm/PfotmBoard'
import { PfotmInput } from '@/components/pfotm/PfotmInput'
import { PfotmHistory } from '@/components/pfotm/PfotmHistory'
import { PfotmRules } from '@/components/pfotm/PfotmRules'
import { Modal, btn, inputCls, labelCls } from '@/components/payroll/Modal'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Skeleton'

type Tab = 'board' | 'input' | 'history' | 'rules'

function defaultPeriod() {
  const now = new Date()
  let month = now.getMonth() + 1
  let year = now.getFullYear()
  if (now.getDate() >= 27) { month++; if (month > 12) { month = 1; year++ } }
  return { year, month }
}

export default function PfotmPage() {
  const { showToast } = useToast()
  const [branchId, setBranchId] = useState<string | null>(null)
  const [ym, setYm] = useState(defaultPeriod)
  const [data, setData] = useState<PfotmBoardData | null>(null)
  const [historyState, setHistory] = useState<{ key: string; rows: PfotmHistoryRow[] } | null>(null)
  const [tab, setTab] = useState<Tab>('board')
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'lock' | 'unlock' | 'participant'>(null)
  const [reason, setReason] = useState('')
  const [candidates, setCandidates] = useState<{ id: string; full_name: string }[]>([])

  const result = useCallback((res: { ok: boolean; error?: string }, success?: string) => {
    if (!res.ok) showToast(res.error ?? 'Gagal', 'error')
    else if (success) showToast(success, 'success')
    return res.ok
  }, [showToast])

  const load = useCallback(async () => {
    const res = await getPfotmBoard(branchId, ym.year, ym.month)
    if (!res.ok) { showToast(res.error, 'error'); return }
    setData(res.data)
    if (!branchId) setBranchId(res.data.branchId)
  }, [branchId, ym, showToast])

  useEffect(() => {
    let cancelled = false
    getPfotmBoard(branchId, ym.year, ym.month).then((res) => {
      if (cancelled) return
      if (!res.ok) { showToast(res.error, 'error'); return }
      setData(res.data)
      if (!branchId) setBranchId(res.data.branchId)
    })
    return () => { cancelled = true }
  }, [branchId, ym, showToast])

  const historyBranch = data?.branchId
  const historyKey = historyBranch ? `${historyBranch}:${ym.year}` : null
  const history = historyState && historyState.key === historyKey ? historyState.rows : null
  useEffect(() => {
    if (tab !== 'history' || !historyBranch || !historyKey) return
    let cancelled = false
    getPfotmHistory(historyBranch, ym.year).then((res) => {
      if (!cancelled) setHistory({ key: historyKey, rows: res.ok ? res.data : [] })
    })
    return () => { cancelled = true }
  }, [tab, historyBranch, historyKey, ym.year])

  const period = data?.period ?? null
  const locked = !!period?.is_locked

  // Live board for open periods; frozen metrics + snapshot weights once locked.
  const board = useMemo(() => {
    if (!data || !period) return []
    return rankBoard(
      data.entries.filter((e) => !e.excluded).map((e) => ({
        key: e.staff_id ?? e.display_name,
        name: e.display_name,
        avatarUrl: e.avatar_url,
        metrics: locked && e.metrics ? e.metrics : mergeMetrics(e.auto_metrics, e.override_metrics),
      })),
      data.rules,
      period.working_days,
    )
  }, [data, period, locked])

  // Same board keyed by entry id for the input table.
  const inputBoard = useMemo(() => {
    if (!data || !period) return []
    return rankBoard(
      data.entries.filter((e) => !e.excluded).map((e) => ({ key: e.id, name: e.display_name, metrics: mergeMetrics(e.auto_metrics, e.override_metrics) })),
      data.rules,
      period.working_days,
    )
  }, [data, period])

  function shiftMonth(delta: number) {
    setYm(({ year, month }) => {
      let m = month + delta, y = year
      if (m < 1) { m = 12; y-- }
      if (m > 12) { m = 1; y++ }
      return { year: y, month: m }
    })
  }

  async function act(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setBusy(key)
    const res = await fn()
    setBusy(null)
    if (result(res, success)) await load()
    return res.ok
  }

  async function onOverride(entryId: string, key: string, value: number | null) {
    // Optimistic so the live preview updates instantly.
    setData((d) => d && ({
      ...d,
      entries: d.entries.map((e) => {
        if (e.id !== entryId) return e
        const override = { ...e.override_metrics }
        if (value === null) delete override[key]
        else override[key] = value
        return { ...e, override_metrics: override }
      }),
    }))
    const res = await setPfotmOverride(entryId, key, value)
    if (!res.ok) { result(res); load() }
  }

  const canInput = !!data?.permissions.canInput
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'board', label: 'Papan Peringkat', show: true },
    { key: 'input', label: 'Input Data', show: !!data?.permissions.canLock },
    { key: 'history', label: 'Riwayat & KPI', show: true },
    { key: 'rules', label: 'Aturan Poin', show: true },
  ]

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F5C542]/20 flex items-center justify-center shrink-0">
            <Trophy size={18} className="text-[#E3A90F]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Powerful Fisioterapis of the Month</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Peringkat bulanan dari kehadiran, kunjungan, penjualan paket dan rujukan — bobot poin dapat diatur.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        {data && data.branches.length > 1 && (
          <select className="px-3 py-2 rounded-xl border border-border bg-background text-sm" value={data.branchId}
            onChange={(e) => setBranchId(e.target.value)} aria-label="Cabang">
            {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-xl border border-border hover:bg-muted" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={15} /></button>
          <div className="px-3 text-center min-w-[150px]">
            <p className="text-sm font-semibold text-foreground">{MONTH_NAMES[ym.month - 1]} {ym.year}</p>
            {period && <p className="text-[10px] text-muted-foreground">{period.start_date} s/d {period.end_date} · {period.working_days} hari kerja</p>}
          </div>
          <button className="p-2 rounded-xl border border-border hover:bg-muted" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya"><ChevronRight size={15} /></button>
        </div>
        {period && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${locked ? 'bg-primary/10 text-primary' : 'bg-chart-4/15 text-chart-4'}`}>
            {locked ? 'Dikunci' : 'Berjalan'}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {period && !locked && data?.permissions.canLock && (
            <button className={btn.primary} disabled={!!busy} onClick={() => setDialog('lock')}><Lock size={14} /> Kunci periode</button>
          )}
          {period && locked && data?.permissions.canUnlock && (
            <button className={btn.ghost} disabled={!!busy} onClick={() => { setReason(''); setDialog('unlock') }}><LockOpen size={14} /> Buka kunci</button>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl overflow-x-auto w-fit max-w-full">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground hover:bg-muted'
            }`}>{t.label}</button>
        ))}
      </div>

      {!data ? <TableSkeleton rows={6} cols={6} /> : (
        <>
          {(tab === 'board' || tab === 'input') && !period && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
              <Trophy className="mx-auto text-[#E3A90F]" size={28} />
              <p className="text-sm font-semibold text-foreground">Periode {MONTH_NAMES[ym.month - 1]} {ym.year} belum dimulai</p>
              {data.permissions.canLock ? (
                <>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Memulai periode akan mendaftarkan fisioterapis aktif dan menarik data absensi, kunjungan, paket dan rujukan secara otomatis.
                  </p>
                  <button className={btn.primary} disabled={busy === 'open'}
                    onClick={() => act('open', () => openPfotmPeriod(data.branchId, ym.year, ym.month), 'Periode dimulai')}>
                    {busy === 'open' ? 'Menyiapkan…' : 'Mulai periode'}
                  </button>
                </>
              ) : <p className="text-xs text-muted-foreground">Menunggu HR memulai periode ini.</p>}
            </div>
          )}

          {tab === 'board' && period && <PfotmBoard board={board} rules={data.rules} wins={data.wins} live={!locked} />}

          {tab === 'input' && period && (
            <>
              {locked && data.permissions.canInput && (
                <p className="text-xs rounded-xl bg-secondary/10 border border-secondary/30 px-3 py-2 text-secondary-foreground">
                  Periode terkunci — perubahan Anda adalah override direktur dan tercatat di log aktivitas.
                </p>
              )}
              <PfotmInput
                entries={data.entries}
                rules={data.rules}
                board={inputBoard}
                workingDays={period.working_days}
                workingDaysOverride={period.working_days_override}
                editable={canInput}
                refreshing={busy === 'refresh'}
                onRefresh={() => act('refresh', () => refreshPfotmAuto(period.id), 'Data otomatis diperbarui')}
                onOverride={onOverride}
                onExclude={(id, ex) => act('exclude', () => setPfotmExcluded(id, ex))}
                onWorkingDays={(d) => act('wd', () => setPfotmWorkingDays(period.id, d), 'Hari kerja diperbarui')}
                onAddParticipant={async () => {
                  const res = await listPfotmCandidates(period.id)
                  if (res.ok) setCandidates(res.data)
                  setDialog('participant')
                }}
              />
            </>
          )}

          {tab === 'history' && (history === null ? <TableSkeleton rows={6} cols={8} /> : <PfotmHistory year={ym.year} history={history} />)}

          {tab === 'rules' && (
            <PfotmRules rules={data.liveRules} editable={data.permissions.canEditRules}
              onSave={(input) => act('rule', () => savePointRule(input), 'Aturan poin disimpan')} />
          )}
        </>
      )}

      {dialog === 'lock' && period && (
        <ConfirmDialog
          title="Kunci periode PFOTM?"
          description={`Data mentah, bobot poin, skor dan peringkat ${MONTH_NAMES[ym.month - 1]} ${ym.year} dibekukan sebagai arsip. ` +
            `Juara saat ini: ${board[0]?.name ?? '—'} (${board[0]?.total ?? 0} poin).`}
          confirmLabel="Kunci"
          loading={busy === 'lock'}
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            await act('lock', () => lockPfotmPeriod(period.id), 'Periode dikunci — selamat untuk sang juara!')
            setDialog(null)
          }}
        />
      )}
      {dialog === 'unlock' && period && (
        <Modal title="Buka kunci periode" onClose={() => setDialog(null)} size="sm"
          footer={<>
            <button className={btn.secondary} onClick={() => setDialog(null)}>Batal</button>
            <button className={btn.danger} disabled={!reason.trim()} onClick={async () => {
              await act('unlock', () => unlockPfotmPeriod(period.id, reason), 'Kunci dibuka')
              setDialog(null)
            }}>Buka kunci</button>
          </>}>
          <label className={labelCls}>Alasan (dicatat di log audit)</label>
          <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Modal>
      )}
      {dialog === 'participant' && period && (
        <Modal title="Tambah peserta" onClose={() => setDialog(null)} size="sm">
          {candidates.length === 0 ? <p className="text-sm text-muted-foreground">Semua staff aktif sudah terdaftar.</p> : (
            <div className="space-y-1">
              {candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground">{c.full_name}</span>
                  <button className={btn.ghost} onClick={async () => {
                    if (await act('add', () => addPfotmParticipant(period.id, c.id), 'Peserta ditambahkan')) {
                      setCandidates((cs) => cs.filter((x) => x.id !== c.id))
                    }
                  }}>Tambah</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
