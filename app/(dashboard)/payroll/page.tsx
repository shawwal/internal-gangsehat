'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarDays, CalendarCheck, ChevronLeft, ChevronRight, ClipboardList, FileText, Lock, LockOpen,
  Settings2, Send, Undo2, UserPlus, Users, Wallet, BadgeCheck, Receipt, Sigma,
} from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  addPayrollAdjustment, deletePayrollAdjustment, getPayrollBootstrap, getPayrollWorkspace, listBindableStaff,
  listPayrollPeriods, lockPayrollPeriod, markPayrollPaid, openPayrollPeriod, refreshAutoActivity, saveAttendanceCells,
  setActivityOverride, setPeriodStaff, submitPayrollPeriod, unlockPayrollPeriod, updatePeriodDay,
  withdrawPayrollSubmission, type PayrollPeriodSummary,
} from '@/app/actions/payroll'
import { MONTH_NAMES } from '@/lib/payroll/period'
import { PERIOD_STATUS_LABEL } from '@/lib/payroll/types'
import { computeWorkspaceRows, rowsFromSlips, type PayrollWorkspace } from '@/lib/payroll/workspace'
import { CalendarStep } from '@/components/payroll/CalendarStep'
import { AttendanceGrid, type CellChange } from '@/components/payroll/AttendanceGrid'
import { ActivityStep } from '@/components/payroll/ActivityStep'
import { AdjustmentsStep } from '@/components/payroll/AdjustmentsStep'
import { RecapStep } from '@/components/payroll/RecapStep'
import { SlipsStep } from '@/components/payroll/SlipsStep'
import { Modal, btn, inputCls, labelCls } from '@/components/payroll/Modal'
import { STATUS_STYLE, formatRupiah } from '@/components/payroll/format'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Skeleton'

type Step = 'calendar' | 'attendance' | 'activity' | 'adjustments' | 'recap' | 'slips'

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'calendar', label: 'Periode', icon: CalendarDays },
  { key: 'attendance', label: 'Absensi', icon: CalendarCheck },
  { key: 'activity', label: 'Aktivitas & Insentif', icon: Sigma },
  { key: 'adjustments', label: 'Denda & Bonus', icon: ClipboardList },
  { key: 'recap', label: 'Rekap Gaji', icon: Receipt },
  { key: 'slips', label: 'Slip Gaji', icon: FileText },
]

function defaultPeriod(): { year: number; month: number } {
  // Before the 27th we are still inside this month's period; after it, next month's.
  const now = new Date()
  const d = now.getDate()
  let month = now.getMonth() + 1
  let year = now.getFullYear()
  if (d >= 27) { month++; if (month > 12) { month = 1; year++ } }
  return { year, month }
}

function PayrollWorkspacePage() {
  const { showToast } = useToast()
  const router = useRouter()
  const params = useSearchParams()
  const periodParam = params.get('period')

  const [role, setRole] = useState<string | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchId, setBranchId] = useState<string>('')
  const [ym, setYm] = useState(defaultPeriod)
  const [periods, setPeriods] = useState<PayrollPeriodSummary[]>([])
  const [periodsFor, setPeriodsFor] = useState<string | null>(null)
  const [wsState, setWs] = useState<PayrollWorkspace | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('attendance')
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'lock' | 'unlock' | 'paid' | 'staff'>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [recordExpense, setRecordExpense] = useState(true)
  const [bindable, setBindable] = useState<{ id: string; full_name: string }[]>([])

  const toastResult = useCallback((res: { ok: boolean; error?: string }, success?: string) => {
    if (!res.ok) showToast(res.error ?? 'Gagal', 'error')
    else if (success) showToast(success, 'success')
    return res.ok
  }, [showToast])

  const currentSummary = periods.find((p) => p.period_year === ym.year && p.period_month === ym.month) ?? null
  // Which period the workspace should show: deep link (?period=…) wins, else the
  // selected branch + month. undefined = the period list is still loading.
  const targetPeriodId: string | null | undefined =
    periodParam ?? (periodsFor === branchId && branchId ? (currentSummary?.id ?? null) : undefined)
  const ws = wsState && wsState.period.id === targetPeriodId ? wsState : null
  const loading = !bootError && (role === null || targetPeriodId === undefined || (targetPeriodId !== null && !ws))
  const frozen = ws?.period.status === 'locked' || ws?.period.status === 'paid'
  const rows = useMemo(() => (!ws ? [] : frozen ? rowsFromSlips(ws) : computeWorkspaceRows(ws)), [ws, frozen])
  const canPrepare = role === 'director' || role === 'hr' || role === 'manager'

  // ── Loading ───────────────────────────────────────────────────────────────
  useEffect(() => {
    getPayrollBootstrap().then((res) => {
      if (!res.ok) { setBootError(res.error); return }
      setRole(res.data.role)
      setBranches(res.data.branches)
      setBranchId((b) => b || res.data.branchId || res.data.branches[0]?.id || '')
    })
  }, [showToast])

  const loadPeriods = useCallback(async (bid: string) => {
    if (!bid) return
    const res = await listPayrollPeriods(bid)
    if (res.ok) setPeriods(res.data)
    setPeriodsFor(bid)
  }, [])

  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    listPayrollPeriods(branchId).then((res) => {
      if (cancelled) return
      if (res.ok) setPeriods(res.data)
      setPeriodsFor(branchId)
    })
    return () => { cancelled = true }
  }, [branchId])

  useEffect(() => {
    if (!targetPeriodId) return
    let cancelled = false
    getPayrollWorkspace(targetPeriodId).then((res) => {
      if (cancelled) return
      if (!res.ok) { showToast(res.error, 'error'); return }
      setWs(res.data)
      if (periodParam) {
        // Align the pickers with the deep-linked period.
        setBranchId(res.data.period.branch_id)
        setYm({ year: res.data.period.period_year, month: res.data.period.period_month })
      }
    })
    return () => { cancelled = true }
  }, [targetPeriodId, periodParam, showToast])

  function shiftMonth(delta: number) {
    if (periodParam) router.replace('/payroll')
    setYm(({ year, month }) => {
      let m = month + delta, y = year
      if (m < 1) { m = 12; y-- }
      if (m > 12) { m = 1; y++ }
      return { year: y, month: m }
    })
  }

  async function createPeriod() {
    setBusy('create')
    const res = await openPayrollPeriod(branchId, ym.year, ym.month)
    setBusy(null)
    if (!toastResult(res, 'Periode dibuat — kalender & daftar karyawan sudah disiapkan')) return
    await loadPeriods(branchId)   // the new period becomes the target and loads
  }

  const reload = useCallback(async () => {
    if (!ws) return
    const res = await getPayrollWorkspace(ws.period.id)
    if (res.ok) setWs(res.data)
    else showToast(res.error, 'error')
  }, [ws, showToast])

  // ── Attendance: optimistic + batched saves ────────────────────────────────
  const pending = useRef<Map<string, CellChange>>(new Map())
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushAttendance = useCallback(async () => {
    if (!ws || pending.current.size === 0) return
    const batch = [...pending.current.values()]
    pending.current.clear()
    const res = await saveAttendanceCells(ws.period.id, batch)
    if (!res.ok) {
      showToast(res.error, 'error')
      reload()
    }
  }, [ws, showToast, reload])

  function onAttendanceChange(changes: CellChange[]) {
    setWs((prev) => {
      if (!prev) return prev
      const attendance = { ...prev.attendance }
      for (const c of changes) {
        const row = { ...(attendance[c.staffId] ?? {}) }
        if (c.code === null) delete row[c.date]
        else row[c.date] = c.code
        attendance[c.staffId] = row
      }
      return { ...prev, attendance }
    })
    for (const c of changes) pending.current.set(`${c.staffId}|${c.date}`, c)
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(flushAttendance, changes.length > 1 ? 0 : 500)
  }

  useEffect(() => () => { if (flushTimer.current) clearTimeout(flushTimer.current) }, [])

  // ── Other edits ───────────────────────────────────────────────────────────
  async function onToggleDay(date: string, workday: boolean, note: string | null) {
    if (!ws) return
    const res = await updatePeriodDay(ws.period.id, date, workday, note)
    if (toastResult(res)) reload()
  }

  async function onOverride(staffId: string, code: string, value: number | null) {
    if (!ws) return
    setWs((prev) => {
      if (!prev) return prev
      const cells = { ...(prev.activity[staffId] ?? {}) }
      const cur = cells[code] ?? { auto: 0, override: null, note: null }
      cells[code] = { ...cur, override: value }
      return { ...prev, activity: { ...prev.activity, [staffId]: cells } }
    })
    const res = await setActivityOverride(ws.period.id, staffId, code, value, null)
    if (!res.ok) { toastResult(res); reload() }
  }

  async function onRefreshActivity() {
    if (!ws) return
    setBusy('refresh')
    const res = await refreshAutoActivity(ws.period.id)
    setBusy(null)
    if (toastResult(res, 'Data sesi diperbarui dari jadwal harian')) reload()
  }

  async function onAddAdjustment(input: Parameters<React.ComponentProps<typeof AdjustmentsStep>['onAdd']>[0]) {
    if (!ws) return false
    const res = await addPayrollAdjustment({ periodId: ws.period.id, ...input })
    if (toastResult(res, 'Penyesuaian disimpan')) { reload(); return true }
    return false
  }

  async function onDeleteAdjustment(id: string) {
    const res = await deletePayrollAdjustment(id)
    if (toastResult(res, 'Penyesuaian dihapus')) reload()
  }

  // ── Workflow ──────────────────────────────────────────────────────────────
  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(key)
    await flushAttendance()
    const res = await fn()
    setBusy(null)
    setDialog(null)
    if (toastResult(res, success)) {
      await Promise.all([reload(), loadPeriods(branchId)])
    }
  }

  async function openStaffDialog() {
    if (!ws) return
    const res = await listBindableStaff(ws.period.id)
    if (res.ok) setBindable(res.data)
    setDialog('staff')
  }

  async function toggleStaff(staffId: string, include: boolean) {
    if (!ws) return
    const res = await setPeriodStaff(ws.period.id, staffId, include)
    if (!toastResult(res, include ? 'Karyawan ditambahkan' : 'Karyawan dikeluarkan dari periode')) return
    await reload()
    const list = await listBindableStaff(ws.period.id)
    if (list.ok) setBindable(list.data)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const status = ws?.period.status
  const missingComp = rows.filter((r) => !r.result).length
  const totalNet = rows.reduce((s, r) => s + (r.result?.net ?? 0), 0)

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Penggajian</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Absensi, insentif, denda dan slip gaji dalam satu alur — dihitung otomatis dari aturan yang dikonfigurasi.
            </p>
          </div>
        </div>
        {canPrepare && (
          <Link href="/payroll/settings" className={btn.secondary}><Settings2 size={14} /> Pengaturan & Karyawan</Link>
        )}
      </div>

      {/* Period bar */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        {branches.length > 1 ? (
          <select
            className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
            value={branchId}
            onChange={(e) => { if (periodParam) router.replace('/payroll'); setBranchId(e.target.value) }}
            aria-label="Cabang"
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        ) : (
          <span className="text-sm font-medium text-foreground">{branches[0]?.name}</span>
        )}
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-xl border border-border hover:bg-muted" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={15} /></button>
          <div className="px-3 text-center min-w-[150px]">
            <p className="text-sm font-semibold text-foreground">{MONTH_NAMES[ym.month - 1]} {ym.year}</p>
            {ws && <p className="text-[10px] text-muted-foreground">{ws.period.start_date} s/d {ws.period.end_date}</p>}
          </div>
          <button className="p-2 rounded-xl border border-border hover:bg-muted" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya"><ChevronRight size={15} /></button>
        </div>
        {ws && status && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[status]}`}>{PERIOD_STATUS_LABEL[status]}</span>
        )}
        {ws && (
          <span className="text-xs text-muted-foreground">
            {ws.staff.length} karyawan · total <b className="text-foreground">{formatRupiah(totalNet)}</b>
          </span>
        )}

        <div className="flex flex-wrap gap-2 ml-auto">
          {ws?.permissions.canEdit && (
            <button className={btn.ghost} onClick={openStaffDialog}><Users size={14} /> Karyawan</button>
          )}
          {ws && canPrepare && status === 'draft' && (
            <button className={btn.secondary} disabled={!!busy} onClick={() => run('submit', () => submitPayrollPeriod(ws.period.id), 'Diajukan untuk persetujuan')}>
              <Send size={14} /> Ajukan
            </button>
          )}
          {ws && canPrepare && status === 'submitted' && (
            <button className={btn.ghost} disabled={!!busy} onClick={() => run('withdraw', () => withdrawPayrollSubmission(ws.period.id), 'Pengajuan ditarik')}>
              <Undo2 size={14} /> Tarik pengajuan
            </button>
          )}
          {ws?.permissions.canApprove && (status === 'draft' || status === 'submitted') && (
            <button className={btn.primary} disabled={!!busy || missingComp > 0} onClick={() => setDialog('lock')}
              title={missingComp ? `${missingComp} karyawan belum punya data kompensasi` : undefined}>
              <Lock size={14} /> Setujui & Kunci
            </button>
          )}
          {ws?.permissions.canApprove && status === 'locked' && (
            <button className={btn.ghost} disabled={!!busy} onClick={() => { setUnlockReason(''); setDialog('unlock') }}>
              <LockOpen size={14} /> Buka kunci
            </button>
          )}
          {ws?.permissions.canMarkPaid && status === 'locked' && (
            <button className={btn.primary} disabled={!!busy} onClick={() => setDialog('paid')}>
              <BadgeCheck size={14} /> Tandai dibayar
            </button>
          )}
        </div>
      </div>

      {ws?.period.unlock_reason && status === 'draft' && (
        <p className="text-xs rounded-xl bg-secondary/10 border border-secondary/30 px-3 py-2 text-secondary-foreground">
          Periode dibuka kembali: {ws.period.unlock_reason}
        </p>
      )}

      {bootError ? (
        <p className="text-sm text-destructive">{bootError}</p>
      ) : loading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : !ws ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
          <CalendarDays className="mx-auto text-primary" size={28} />
          <p className="text-sm font-semibold text-foreground">Periode {MONTH_NAMES[ym.month - 1]} {ym.year} belum dibuka</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Membuka periode akan membuat kalender (tanggal mulai sesuai pengaturan, mis. 27 → 26), menandai hari libur,
            mendaftarkan karyawan aktif, dan menarik data sesi dari jadwal harian.
          </p>
          {canPrepare ? (
            <button className={btn.primary} disabled={busy === 'create' || !branchId} onClick={createPeriod}>
              {busy === 'create' ? 'Menyiapkan…' : 'Buka periode'}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">Menunggu HR membuka periode ini.</p>
          )}
          {periods.length > 0 && (
            <div className="pt-3 flex flex-wrap justify-center gap-2">
              {periods.slice(0, 6).map((p) => (
                <button key={p.id} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted"
                  onClick={() => setYm({ year: p.period_year, month: p.period_month })}>
                  {MONTH_NAMES[p.period_month - 1]} {p.period_year} · {PERIOD_STATUS_LABEL[p.status]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {missingComp > 0 && (
            <p className="text-xs rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive">
              {missingComp} karyawan belum punya data kompensasi (gaji pokok, tunjangan, insentif).{' '}
              {canPrepare && <Link href="/payroll/settings" className="underline font-medium">Lengkapi di Pengaturan</Link>}
            </p>
          )}

          {/* Steps */}
          <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl overflow-x-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <button key={s.key} onClick={() => setStep(s.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    step === s.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                  }`}>
                  <span className="text-[10px] opacity-70">{i + 1}</span><Icon size={14} /> {s.label}
                </button>
              )
            })}
          </div>

          {step === 'calendar' && <CalendarStep ws={ws} onToggleDay={onToggleDay} />}
          {step === 'attendance' && <AttendanceGrid ws={ws} rows={rows} onChange={onAttendanceChange} />}
          {step === 'activity' && (
            <ActivityStep ws={ws} rows={rows} refreshing={busy === 'refresh'} onRefresh={onRefreshActivity} onOverride={onOverride} />
          )}
          {step === 'adjustments' && <AdjustmentsStep ws={ws} onAdd={onAddAdjustment} onDelete={onDeleteAdjustment} />}
          {step === 'recap' && <RecapStep ws={ws} rows={rows} />}
          {step === 'slips' && <SlipsStep ws={ws} rows={rows} />}
        </>
      )}

      {/* Dialogs */}
      {dialog === 'lock' && ws && (
        <ConfirmDialog
          title="Setujui & kunci periode?"
          description={`${ws.staff.length} slip gaji (total ${formatRupiah(totalNet)}) akan dibuat permanen dan karyawan mendapat notifikasi. ` +
            `Absensi, aktivitas dan penyesuaian periode ini tidak bisa diubah lagi kecuali kunci dibuka.` +
            (rows.some((r) => r.warnings.length) ? ' Masih ada peringatan yang belum dicek di Rekap Gaji.' : '')}
          confirmLabel="Setujui & Kunci"
          loading={busy === 'lock'}
          onCancel={() => setDialog(null)}
          onConfirm={() => run('lock', () => lockPayrollPeriod(ws.period.id), 'Periode dikunci & slip gaji diterbitkan')}
        />
      )}
      {dialog === 'unlock' && ws && (
        <Modal title="Buka kunci periode" subtitle="Slip yang sudah terbit akan ditarik dan dibuat ulang saat dikunci kembali."
          onClose={() => setDialog(null)} size="sm"
          footer={
            <>
              <button className={btn.secondary} onClick={() => setDialog(null)}>Batal</button>
              <button className={btn.danger} disabled={!unlockReason.trim() || busy === 'unlock'}
                onClick={() => run('unlock', () => unlockPayrollPeriod(ws.period.id, unlockReason), 'Kunci periode dibuka')}>
                Buka kunci
              </button>
            </>
          }>
          <label className={labelCls}>Alasan (dicatat di log aktivitas)</label>
          <textarea className={inputCls} rows={3} value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)}
            placeholder="mis. Koreksi absensi Okta tanggal 8" />
        </Modal>
      )}
      {dialog === 'paid' && ws && (
        <Modal title="Tandai gaji sudah dibayar" onClose={() => setDialog(null)} size="sm"
          footer={
            <>
              <button className={btn.secondary} onClick={() => setDialog(null)}>Batal</button>
              <button className={btn.primary} disabled={busy === 'paid'}
                onClick={() => run('paid', () => markPayrollPaid(ws.period.id, recordExpense), 'Periode ditandai dibayar')}>
                Konfirmasi
              </button>
            </>
          }>
          <p className="text-sm text-muted-foreground">Total gaji: <b className="text-foreground">{formatRupiah(ws.slips.reduce((s, x) => s + x.net, 0))}</b></p>
          <label className="mt-3 flex items-start gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={recordExpense} onChange={(e) => setRecordExpense(e.target.checked)} />
            Catat sebagai pengeluaran kategori <b>GAJI</b> di Transaksi cabang
          </label>
        </Modal>
      )}
      {dialog === 'staff' && ws && (
        <Modal title="Karyawan dalam periode" subtitle="Karyawan aktif cabang otomatis terdaftar saat periode dibuka." onClose={() => setDialog(null)}>
          <div className="space-y-4">
            <div className="space-y-1">
              {ws.staff.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{s.full_name}</span>
                  <button className="text-xs text-destructive hover:underline" onClick={() => toggleStaff(s.id, false)}>Keluarkan</button>
                </div>
              ))}
            </div>
            {bindable.length > 0 && (
              <div>
                <p className={labelCls}>Tambahkan</p>
                <div className="space-y-1">
                  {bindable.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="text-sm text-muted-foreground">{s.full_name}</span>
                      <button className={btn.ghost} onClick={() => toggleStaff(s.id, true)}><UserPlus size={13} /> Tambah</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<div className="p-6"><TableSkeleton rows={8} cols={8} /></div>}>
      <PayrollWorkspacePage />
    </Suspense>
  )
}
