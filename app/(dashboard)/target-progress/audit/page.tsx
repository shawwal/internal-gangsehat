'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getAchievementAudit, type AuditData } from '@/app/actions/achievementAudit'
import { getPayrollWindow } from '@/app/actions/pfotm'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/excel-export'

type Tab = 'visits' | 'sales'
type Filter = 'all' | 'valid' | 'invalid'

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const rp = (n: number) => `Rp${n.toLocaleString('id-ID')}`

// Every visit and sale behind Target Progress / PFOTM / Payroll — counted or not,
// with the reason a row is left out (director / manager / HR only).
export default function AchievementAuditPage() {
  const now = new Date()
  const [branchId, setBranchId] = useState<string | null>(null)
  const [range, setRange] = useState<{ start: string; end: string } | null>(null)
  // Result tagged with the query it answers, so "loading" = no result for the current query yet.
  const [result, setResult] = useState<{ key: string; data: AuditData | null; error: string | null } | null>(null)
  const [tab, setTab] = useState<Tab>('visits')
  const [filter, setFilter] = useState<Filter>('invalid')
  const [q, setQ] = useState('')

  // Default window: the branch's current payroll period (27 → 26).
  useEffect(() => {
    if (range) return
    let cancelled = false
    ;(async () => {
      const first = await getAchievementAudit(branchId, '2000-01-01', '2000-01-01')
      if (cancelled) return
      if (!first.ok) { setResult({ key: 'init', data: null, error: first.error }); return }
      const win = await getPayrollWindow(first.data.branchId, now.getFullYear(), now.getMonth() + 1)
      if (cancelled) return
      setBranchId(first.data.branchId)
      setRange(win.ok ? win.data : {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA'),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA'),
      })
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queryKey = range ? `${branchId}|${range.start}|${range.end}` : 'init'
  useEffect(() => {
    if (!range) return
    let cancelled = false
    getAchievementAudit(branchId, range.start, range.end).then((res) => {
      if (cancelled) return
      setResult(res.ok ? { key: queryKey, data: res.data, error: null } : { key: queryKey, data: null, error: res.error })
    })
    return () => { cancelled = true }
  }, [branchId, range, queryKey])
  const loading = result?.key !== queryKey
  const data = result?.data ?? null
  const error = result?.key === queryKey || result?.key === 'init' ? result?.error ?? null : null

  const term = q.trim().toLowerCase()
  const keep = (issues: string[], text: string) =>
    (filter === 'all' || (filter === 'valid') === (issues.length === 0)) && (!term || text.toLowerCase().includes(term))
  const visits = useMemo(() => (data?.visits ?? []).filter((v) =>
    keep(v.issues, `${v.patientName} ${v.therapist} ${v.layanan ?? ''} ${v.issues.join(' ')}`)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, filter, term])
  const sales = useMemo(() => (data?.sales ?? []).filter((s) =>
    keep(s.issues, `${s.patientName} ${s.therapist} ${s.category} ${s.issues.join(' ')}`)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, filter, term])

  const visitValid = data?.visits.filter((v) => !v.issues.length).length ?? 0
  const openRecords = data?.visits.filter((v) => v.issues.includes('Belum Ditangani') || v.issues.includes('Belum Diperiksa')).length ?? 0
  const saleValid = data?.sales.filter((s) => !s.issues.length).length ?? 0

  async function handleExport() {
    if (tab === 'visits') {
      return exportToExcel(visits, [
        { header: 'Tanggal', value: (r) => r.date },
        { header: 'Jam', value: (r) => r.time ?? '' },
        { header: 'Pasien', value: (r) => r.patientName },
        { header: 'Terapis', value: (r) => r.therapist },
        { header: 'Layanan', value: (r) => r.layanan ?? '' },
        { header: 'Kehadiran', value: (r) => r.kehadiran ?? '' },
        { header: 'Valid', value: (r) => (r.issues.length ? 'Tidak' : 'Ya') },
        { header: 'Alasan', value: (r) => r.issues.join('; ') },
      ], `audit-kunjungan-${range?.start}-${range?.end}`)
    }
    return exportToExcel(sales, [
      { header: 'Tanggal', value: (r) => r.date },
      { header: 'Pasien', value: (r) => r.patientName },
      { header: 'Terapis', value: (r) => r.therapist },
      { header: 'Kategori', value: (r) => r.category },
      { header: 'Harga', value: (r) => r.harga },
      { header: 'Diskon', value: (r) => r.discount },
      { header: 'Dibayar', value: (r) => r.amount },
      { header: 'Pembayaran', value: (r) => r.paymentStatus ?? '' },
      { header: 'Metode', value: (r) => r.paymentMethod ?? '' },
      { header: 'Bukti', value: (r) => (r.hasProof ? 'Ada' : 'Tidak') },
      { header: 'Valid', value: (r) => (r.issues.length ? 'Tidak' : 'Ya') },
      { header: 'Alasan', value: (r) => r.issues.join('; ') },
    ], `audit-transaksi-${range?.start}-${range?.end}`)
  }

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground hover:bg-muted'}`
  const issueCell = (issues: string[]) => issues.length === 0
    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#34C759]/15 text-[#34C759]">Valid</span>
    : <div className="flex flex-wrap gap-1">{issues.map((i) => (
        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">{i}</span>
      ))}</div>

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Audit Capaian</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Semua kunjungan & transaksi — yang dihitung maupun tidak di Progress Target, PFOTM dan Penggajian, beserta alasannya.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        {data && data.branches.length > 1 && (
          <select className="px-3 py-2 rounded-xl border border-border bg-background text-sm" value={data.branchId}
            onChange={(e) => setBranchId(e.target.value)} aria-label="Cabang">
            {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {range && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Tanggal</span>
            <input type="date" value={range.start} max={range.end} aria-label="Dari tanggal"
              onChange={(e) => e.target.value && setRange({ ...range, start: e.target.value })}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm" />
            <span className="text-muted-foreground">–</span>
            <input type="date" value={range.end} min={range.start} aria-label="Sampai tanggal"
              onChange={(e) => e.target.value && setRange({ ...range, end: e.target.value })}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm" />
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pasien, terapis, layanan, alasan…"
          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-border bg-background text-sm" />
        <ExportButton onExport={handleExport} />
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Kunjungan valid', `${visitValid} / ${data.visits.length}`],
            ['Rekam medis belum selesai', String(openRecords)],
            ['Transaksi valid', `${saleValid} / ${data.sales.length}`],
            ['Transaksi tidak valid', String(data.sales.length - saleValid)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-border bg-card p-3">
              <p className="text-lg font-bold text-foreground">{v}</p>
              <p className="text-[11px] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl">
          <button className={pill(tab === 'visits')} onClick={() => setTab('visits')}>Kunjungan</button>
          <button className={pill(tab === 'sales')} onClick={() => setTab('sales')}>Transaksi</button>
        </div>
        <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl">
          <button className={pill(filter === 'invalid')} onClick={() => setFilter('invalid')}>Tidak valid</button>
          <button className={pill(filter === 'valid')} onClick={() => setFilter('valid')}>Valid</button>
          <button className={pill(filter === 'all')} onClick={() => setFilter('all')}>Semua</button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      ) : loading || !data ? <TableSkeleton rows={8} cols={6} /> : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          {tab === 'visits' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border text-left">
                  <th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Pasien</th>
                  <th className="px-3 py-2 font-medium">Terapis</th><th className="px-3 py-2 font-medium">Layanan</th>
                  <th className="px-3 py-2 font-medium">Kehadiran</th><th className="px-3 py-2 font-medium">Status hitung</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(v.date)}{v.time ? ` · ${v.time.slice(0, 5)}` : ''}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{v.patientName}</td>
                    <td className="px-3 py-2">{v.therapist}</td>
                    <td className="px-3 py-2">{v.layanan ?? '—'}</td>
                    <td className="px-3 py-2">{v.kehadiran ?? '—'}</td>
                    <td className="px-3 py-2">{issueCell(v.issues)}</td>
                  </tr>
                ))}
                {!visits.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Tidak ada data.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border text-left">
                  <th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Pasien</th>
                  <th className="px-3 py-2 font-medium">Terapis</th><th className="px-3 py-2 font-medium">Kategori</th>
                  <th className="px-3 py-2 font-medium text-right">Harga</th><th className="px-3 py-2 font-medium text-right">Dibayar</th>
                  <th className="px-3 py-2 font-medium">Pembayaran</th><th className="px-3 py-2 font-medium">Bukti</th>
                  <th className="px-3 py-2 font-medium">Status hitung</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(s.date)}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{s.patientName}</td>
                    <td className="px-3 py-2">{s.therapist}</td>
                    <td className="px-3 py-2">{s.category}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{rp(s.harga - s.discount)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{rp(s.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.paymentStatus ?? '—'} · {s.paymentMethod ?? '—'}</td>
                    <td className="px-3 py-2">{s.hasProof ? 'Ada' : '—'}</td>
                    <td className="px-3 py-2">{issueCell(s.issues)}</td>
                  </tr>
                ))}
                {!sales.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Tidak ada data.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
