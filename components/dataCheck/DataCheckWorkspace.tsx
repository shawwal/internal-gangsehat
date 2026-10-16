'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ClipboardCheck, ExternalLink, Loader2, Sparkles, UserCheck } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  applyTherapistSuggestions, exportDataCheck, getDataCheck, setDataCheckTherapist,
  type DataCheckData, type DataCheckRow, type DataCheckTab,
} from '@/app/actions/dataCheck'
import { TX_ISSUES, VISIT_ISSUES } from '@/lib/finance/dataCheck'
import { DateRangeFilter } from '@/components/finance/DateRangeFilter'
import { Pagination } from '@/components/leave/Pagination'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import { ExportButton } from '@/components/ui/ExportButton'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// Same badges as the finance Outstanding table (components/finance/OutstandingRow.tsx).
const PAY_STATUS_CLS: Record<string, string> = {
  LUNAS: 'bg-green-500/15 text-green-400',
  DP: 'bg-yellow-500/15 text-yellow-400',
  PELUNASAN: 'bg-primary/15 text-primary',
}

function thisMonth() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const [y, m] = today.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const fmtShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
const fmtRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export function DataCheckWorkspace() {
  const { showToast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const def = thisMonth()
  const tab: DataCheckTab = sp.get('tab') === 'kunjungan' ? 'kunjungan' : 'transaksi'
  const issues = tab === 'kunjungan' ? VISIT_ISSUES : TX_ISSUES
  const issueParam = sp.get('issue') ?? ''
  const issue = issueParam in issues ? issueParam : ''
  const from = ISO.test(sp.get('from') ?? '') ? sp.get('from')! : def.from
  const to = ISO.test(sp.get('to') ?? '') ? sp.get('to')! : def.to
  const branchParam = sp.get('branch')
  const page = Math.max(1, Number(sp.get('page')) || 1)

  const [data, setData] = useState<DataCheckData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const queryKey = JSON.stringify([branchParam, from, to, tab, issue, page, reloadKey])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== queryKey
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const setParams = useCallback((next: Record<string, string | null>, resetPage = true) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') p.delete(k)
      else p.set(k, v)
    }
    if (resetPage && !('page' in next)) p.delete('page')
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [sp, router, pathname])

  useEffect(() => {
    let cancelled = false
    getDataCheck({ branchId: branchParam, from, to, tab, issue, page }).then((res) => {
      if (cancelled) return
      setLoadedKey(queryKey)
      if (!res.ok) { setError(res.error); return }
      setError(null)
      setData(res.data)
      setPicks({})
    })
    return () => { cancelled = true }
  }, [branchParam, from, to, tab, issue, page, reloadKey, queryKey])

  const reload = () => setReloadKey((k) => k + 1)

  async function assign(row: DataCheckRow) {
    const staffId = picks[row.id] ?? row.suggestion?.staffId ?? ''
    if (!staffId) { showToast('Pilih Fisio dulu.', 'error'); return }
    setSaving(row.id)
    const res = await setDataCheckTherapist(tab, [row.id], staffId)
    setSaving(null)
    if (!res.ok) { showToast(res.error, 'error'); return }
    showToast('Fisio disimpan', 'success')
    reload()
  }

  async function applyAll() {
    setSaving('bulk')
    const res = await applyTherapistSuggestions({ branchId: data?.branchId ?? branchParam, from, to, tab })
    setSaving(null)
    setConfirmBulk(false)
    if (!res.ok) { showToast(res.error, 'error'); reload(); return }
    showToast(
      `${res.data.applied} baris diberi Fisio${res.data.skipped ? ` · ${res.data.skipped} tanpa saran (isi manual)` : ''}`,
      'success',
    )
    reload()
  }

  async function handleExport() {
    const res = await exportDataCheck({ branchId: data?.branchId ?? branchParam, from, to, tab, issue })
    if (!res.ok) { showToast(res.error, 'error'); return }
    const issueLabel = (k: string) => (issues as Record<string, string>)[k] ?? k
    const cols: ExportColumn<DataCheckRow>[] = [
      { header: 'Tanggal', value: (r) => r.date },
      { header: 'Pasien', value: (r) => r.patientName },
      { header: tab === 'kunjungan' ? 'Layanan' : 'Kategori', value: (r) => r.label ?? '' },
      ...(tab === 'transaksi' ? [
        { header: 'Jumlah', value: (r: DataCheckRow) => r.amount ?? 0 },
        { header: 'Status Pembayaran', value: (r: DataCheckRow) => r.paymentStatus ?? '' },
        { header: 'Metode Pembayaran', value: (r: DataCheckRow) => r.paymentMethod ?? '' },
      ] : [
        { header: 'Kehadiran', value: (r: DataCheckRow) => r.kehadiran ?? '' },
      ]),
      { header: 'Fisio', value: (r) => r.therapistName ?? '' },
      { header: 'Masalah', value: (r) => r.issues.map(issueLabel).join(', ') },
      { header: 'Saran Fisio (terakhir menangani)', value: (r) => r.suggestion ? `${r.suggestion.name} (${r.suggestion.visitDate})` : '' },
    ]
    exportToExcel(res.data, cols, `cek_data_${tab}_${from}_${to}`)
  }

  const counts = data ? data.counts[tab] : null
  const missingFisio = counts?.tanpa_fisio ?? 0
  const showFisioCol = !!data?.rows.some((r) => r.issues.includes('tanpa_fisio'))

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <ClipboardCheck size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Cek Data</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transaksi & kunjungan yang belum lengkap — terutama yang belum punya Fisio, sehingga tidak terhitung di PFOTM, Progress Target per terapis dan laporan keuangan per terapis.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        {data && data.branches.length > 1 && (
          <select
            className="h-9 px-3 rounded-xl border border-border bg-background text-sm"
            value={data.branchId}
            onChange={(e) => setParams({ branch: e.target.value })}
            aria-label="Cabang"
          >
            {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Tanggal</span>
          <DateRangeFilter
            from={from}
            to={to}
            onChange={(f, t) => setParams({ from: f || def.from, to: t || def.to })}
          />
        </div>
        <div className="ml-auto">
          <ExportButton onExport={handleExport} label="Export" disabled={!data || data.total === 0} />
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl w-fit max-w-full overflow-x-auto">
        {(['transaksi', 'kunjungan'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setParams({ tab: t, issue: null })}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground hover:bg-muted'
            }`}
          >
            {t === 'transaksi' ? 'Transaksi' : 'Kunjungan'}
            {data && <span className="ml-1.5 opacity-80">({data.totals[t]})</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <IssueChip active={issue === ''} label="Semua masalah" count={data?.totals[tab]} onClick={() => setParams({ issue: null })} />
        {Object.entries(issues).map(([k, label]) => (
          <IssueChip key={k} active={issue === k} label={label} count={counts?.[k]} onClick={() => setParams({ issue: k })} />
        ))}
      </div>

      {missingFisio > 0 && (issue === '' || issue === 'tanpa_fisio') && (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <Sparkles size={16} className="text-secondary shrink-0" />
          <p className="text-xs text-foreground flex-1 min-w-[220px]">
            <b>{missingFisio}</b> {tab === 'kunjungan' ? 'kunjungan' : 'transaksi'} tanpa Fisio. Saran = <b>fisioterapis terakhir yang menangani pasien</b> (kunjungan hadir terakhir di cabang ini, pada atau sebelum tanggalnya).
          </p>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            disabled={!!saving}
            onClick={() => setConfirmBulk(true)}
          >
            <UserCheck size={14} /> Terapkan semua saran
          </button>
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">{error}</p>
      ) : !data ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className={`rounded-2xl border border-border bg-card overflow-hidden ${loading ? 'opacity-60' : ''}`}>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              {issue ? 'Tidak ada data dengan masalah ini pada rentang tanggal ini.' : 'Semua data pada rentang tanggal ini sudah lengkap.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border bg-muted/40">
                    <th className="py-2.5 px-3 text-left font-medium">Tanggal</th>
                    <th className="py-2.5 px-3 text-left font-medium">Pasien</th>
                    <th className="py-2.5 px-3 text-left font-medium">{tab === 'kunjungan' ? 'Layanan' : 'Kategori'}</th>
                    {tab === 'transaksi'
                      ? <th className="py-2.5 px-3 text-left font-medium">Pembayaran</th>
                      : <th className="py-2.5 px-3 text-left font-medium">Kehadiran</th>}
                    <th className="py-2.5 px-3 text-left font-medium">Fisio</th>
                    <th className="py-2.5 px-3 text-left font-medium">Masalah</th>
                    {showFisioCol && <th className="py-2.5 px-3 text-left font-medium">Tetapkan Fisio</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 align-top hover:bg-muted/20">
                      <td className="py-2 px-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-2 px-3 font-medium text-foreground">
                        {r.patientId ? (
                          <Link href={`/patients/${r.patientId}`} className="hover:underline inline-flex items-center gap-1">
                            {r.patientName} <ExternalLink size={11} className="opacity-50" />
                          </Link>
                        ) : r.patientName}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{r.label ?? '—'}</td>
                      {tab === 'transaksi' ? (
                        <td className="py-2 px-3">
                          <div className="font-semibold text-foreground">{fmtRp(r.amount ?? 0)}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {r.paymentStatus && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PAY_STATUS_CLS[r.paymentStatus] ?? 'bg-muted text-muted-foreground'}`}>
                                {r.paymentStatus}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">{r.paymentMethod ?? '—'}</span>
                          </div>
                        </td>
                      ) : (
                        <td className="py-2 px-3 text-xs">{r.kehadiran ?? <span className="text-muted-foreground">—</span>}</td>
                      )}
                      <td className="py-2 px-3 text-xs">
                        {r.therapistName ?? <span className="text-destructive font-semibold">—</span>}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {r.issues.map((k) => (
                            <span key={k} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive whitespace-nowrap">
                              {(issues as Record<string, string>)[k] ?? k}
                            </span>
                          ))}
                        </div>
                      </td>
                      {showFisioCol && (
                        <td className="py-2 px-3">
                          {r.issues.includes('tanpa_fisio') && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={picks[r.id] ?? r.suggestion?.staffId ?? ''}
                                  onChange={(e) => setPicks((p) => ({ ...p, [r.id]: e.target.value }))}
                                  className="h-8 max-w-[170px] px-2 rounded-lg border border-border bg-background text-xs"
                                  aria-label={`Fisio untuk ${r.patientName}`}
                                >
                                  <option value="">Pilih Fisio…</option>
                                  {data.therapists.filter((t) => !t.inactive).map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                  {r.suggestion && !data.therapists.some((t) => t.id === r.suggestion!.staffId) && (
                                    <option value={r.suggestion.staffId}>{r.suggestion.name}</option>
                                  )}
                                </select>
                                <button
                                  onClick={() => assign(r)}
                                  disabled={!!saving}
                                  className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  {saving === r.id ? <Loader2 size={12} className="animate-spin" /> : 'Simpan'}
                                </button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {r.suggestion
                                  ? <>Saran: <b className="text-foreground">{r.suggestion.name}</b> · terakhir menangani {fmtShort(r.suggestion.visitDate)}</>
                                  : 'Belum ada kunjungan sebelumnya — pilih manual'}
                              </p>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.total > data.pageSize && (
            <div className="border-t border-border p-3">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ page: String(p) }, false)} />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Fisio sebuah transaksi = kolom Fisio, atau terapis kunjungan yang ditautkan — aturan yang sama dengan halaman Keuangan, Progress Target dan PFOTM, jadi perbaikan di sini langsung terlihat di semua halaman itu.
        Masalah lain (status bayar, bukti transfer, kehadiran, rekam medis) diperbaiki dari halaman transaksi / pasien terkait. Setiap perubahan tercatat di log aktivitas.
      </p>

      {confirmBulk && (
        <ConfirmDialog
          title="Terapkan semua saran Fisio?"
          description={`Hingga ${missingFisio} ${tab === 'kunjungan' ? 'kunjungan' : 'transaksi'} tanpa Fisio pada ${from} s/d ${to} akan diberi Fisio = fisioterapis terakhir yang menangani pasiennya. Baris tanpa saran dilewati. Perubahan tercatat di log aktivitas.`}
          confirmLabel="Terapkan"
          loading={saving === 'bulk'}
          onConfirm={applyAll}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </div>
  )
}

function IssueChip({ active, label, count, onClick }: { active: boolean; label: string; count: number | undefined; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 font-bold ${!active && count > 0 ? 'text-destructive' : ''}`}>{count}</span>
      )}
    </button>
  )
}
