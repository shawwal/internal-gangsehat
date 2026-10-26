'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, ArrowUpDown, BadgeDollarSign, Search, Users, Wallet, X } from 'lucide-react'
import { fetchSportMassagePayroll, type SportMassagePayrollData } from '@/app/actions/sportMassagePayroll'
import type { SportMassageExportRow } from '@/app/actions/sportMassageExport'
import { MonthPicker } from '@/components/targetProgress/MonthPicker'
import { MONTHS } from '@/components/targetProgress/utils'
import { TherapistCombobox, type TherapistOption } from '@/components/finance/TherapistServiceFilters'
import { formatRp } from '@/components/director/finance/types'
import { ExportButton } from '@/components/ui/ExportButton'
import { SkeletonRegion, TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/context/ToastContext'
import { dateCell, money, slug, kehadiranLabel, VISIT_STATUS_LABEL, type Cell } from '../xlsx'
import { FeeRatesDialog } from './FeeRatesDialog'
import { buildFeeLookup, currentPeriod, isPaidSession } from './utils'

const NO_THERAPIST = 'none'
const CONTROL = 'h-9 px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors'

const SORT_OPTIONS = [
  { value: 'date_asc',      label: 'Tanggal terlama' },
  { value: 'date_desc',     label: 'Tanggal terbaru' },
  { value: 'patient_asc',   label: 'Nama pasien A–Z' },
  { value: 'therapist_asc', label: 'Nama terapis A–Z' },
  { value: 'service_asc',   label: 'Layanan A–Z' },
] as const
type Sort = typeof SORT_OPTIONS[number]['value']

const KEHADIRAN_OPTIONS = [
  { value: '',            label: 'Semua Kehadiran' },
  { value: 'HADIR',       label: 'Hadir' },
  { value: 'TIDAK HADIR', label: 'Tidak Hadir' },
  { value: 'NONE',        label: 'Belum Diisi' },
]

/** Visit plus its computed payroll fee (null = not paid / no rate). */
interface Row extends SportMassageExportRow {
  paid: boolean
  fee: number | null
}

const byText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').localeCompare(b ?? '', 'id', { sensitivity: 'base' })
const byDate = (a: Row, b: Row) => byText(a.visit_date, b.visit_date) || byText(a.visit_time, b.visit_time)
const SORTERS: Record<Sort, (a: Row, b: Row) => number> = {
  date_asc:      byDate,
  date_desc:     (a, b) => byDate(b, a),
  patient_asc:   (a, b) => byText(a.patient_name, b.patient_name) || byDate(a, b),
  therapist_asc: (a, b) => Number(!a.therapist_id) - Number(!b.therapist_id) || byText(a.therapist_name, b.therapist_name) || byDate(a, b),
  service_asc:   (a, b) => byText(a.layanan, b.layanan) || byDate(a, b),
}

// "Sab 27 Sep 2026" — same as the other visit-detail lists.
const fmtDay = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '')
const fmtLong = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

interface Props {
  branches: { id: string; name: string }[]
  initialBranchId: string
  /** director / hr may switch branch */
  canSwitchBranch: boolean
}

export function SportMassagePayrollView({ branches, initialBranchId, canSwitchBranch }: Props) {
  const { showToast } = useToast()
  const [branchId, setBranchId] = useState(initialBranchId)
  const [period, setPeriod]     = useState(() => currentPeriod())
  const [data, setData]         = useState<SportMassagePayrollData | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [ratesOpen, setRatesOpen] = useState(false)

  const [q, setQ]                 = useState('')
  const [therapist, setTherapist] = useState('')
  const [service, setService]     = useState('')
  const [kehadiran, setKehadiran] = useState('')
  const [sort, setSort]           = useState<Sort>('date_asc')

  const branchName = branches.find((b) => b.id === branchId)?.name ?? ''

  const load = useCallback(async () => {
    setData(null)
    setError(null)
    const res = await fetchSportMassagePayroll(branchId, period.year, period.month)
    if (res.ok) setData(res.data)
    else setError(res.error)
  }, [branchId, period])
  // Standard fetch-on-param-change; `load` resets state before its await settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const feeOf = buildFeeLookup(data.rates)
    return data.visits.map((v) => {
      const paid = isPaidSession(v)
      return { ...v, paid, fee: paid ? feeOf(v.therapist_id, v.layanan_id) : null }
    })
  }, [data])

  const paidRows = useMemo(() => rows.filter((r) => r.paid), [rows])
  const missingRate = paidRows.filter((r) => r.fee == null).length
  const unmarked = rows.filter((r) => !r.kehadiran && r.status !== 'cancelled').length
  const totalFee = paidRows.reduce((s, r) => s + (r.fee ?? 0), 0)

  // Recap: one row per therapist, one count column per Layanan that has paid sessions.
  const recapLayanan = useMemo(() => {
    const ids = new Set(paidRows.map((r) => r.layanan_id ?? ''))
    const known = (data?.layanan ?? []).filter((l) => ids.has(l.id)).map((l) => ({ id: l.id, nama: l.nama }))
    return ids.has('') ? [...known, { id: '', nama: 'Tanpa Layanan' }] : known
  }, [paidRows, data])

  const recap = useMemo(() => {
    const out = (data?.therapists ?? []).map((t) => {
      const mine = paidRows.filter((r) => r.therapist_id === t.id)
      const counts = Object.fromEntries(recapLayanan.map((l) => [l.id, mine.filter((r) => (r.layanan_id ?? '') === l.id).length]))
      return { id: t.id, name: t.name, counts, sessions: mine.length, fee: mine.reduce((s, r) => s + (r.fee ?? 0), 0), missing: mine.filter((r) => r.fee == null).length }
    })
    return out.filter((r) => r.sessions > 0 || data?.therapists.find((t) => t.id === r.id)?.is_active)
      .sort((a, b) => b.fee - a.fee || b.sessions - a.sessions || byText(a.name, b.name))
  }, [data, paidRows, recapLayanan])

  // ── Detail list ──────────────────────────────────────────────────────────
  const therapistOptions = useMemo<TherapistOption[] | null>(() => {
    if (!data) return null
    const opts = data.therapists.map((t) => ({ id: t.id, name: t.name, inactive: !t.is_active }))
    if (rows.some((r) => !r.therapist_id)) opts.push({ id: NO_THERAPIST, name: 'Tanpa terapis', inactive: true })
    return opts
  }, [data, rows])

  const serviceOptions = useMemo(
    () => [...new Set(rows.map((r) => r.layanan).filter((s): s is string => !!s))].sort(byText),
    [rows],
  )

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows
      .filter((r) => !therapist || (therapist === NO_THERAPIST ? !r.therapist_id : r.therapist_id === therapist))
      .filter((r) => !service || r.layanan === service)
      .filter((r) => !kehadiran || (kehadiran === 'NONE' ? !r.kehadiran : r.kehadiran === kehadiran))
      .filter((r) => !term || [r.patient_name, r.no_rm, r.therapist_name, r.layanan, r.kategori, r.order_id]
        .some((v) => v?.toLowerCase().includes(term)))
      .sort(SORTERS[sort])
  }, [rows, q, therapist, service, kehadiran, sort])

  const filtered = !!(q.trim() || therapist || service || kehadiran)
  const patientCount = new Set(visible.map((r) => r.patient_id)).size
  const visibleFee = visible.reduce((s, r) => s + (r.fee ?? 0), 0)
  const periodLabel = `${MONTHS[period.month - 1]} ${period.year}`
  const rangeLabel = data ? `${fmtLong(data.start)} – ${fmtLong(data.end)}` : periodLabel

  async function handleExport() {
    if (!data) return
    const XLSX = await import('xlsx')
    const head: Cell[][] = [
      ['Payroll Sport Massage'],
      ['Cabang', branchName],
      ['Periode gaji', `${periodLabel} (${data.start} s/d ${data.end})`],
      ['Sesi hadir', paidRows.length],
      ['Total fee', money(totalFee)],
      [],
    ]

    // Sheet 1 — recap per therapist
    const recapHeader = ['Terapis', ...recapLayanan.map((l) => l.nama), 'Total Sesi Hadir', 'Total Fee', 'Sesi Tanpa Tarif']
    const recapBody: Cell[][] = recap.map((r) => [r.name, ...recapLayanan.map((l) => r.counts[l.id]), r.sessions, money(r.fee), r.missing])
    const recapTotal: Cell[] = [
      'TOTAL',
      ...recapLayanan.map((l) => recap.reduce((s, r) => s + r.counts[l.id], 0)),
      recap.reduce((s, r) => s + r.sessions, 0),
      money(recap.reduce((s, r) => s + r.fee, 0)),
      recap.reduce((s, r) => s + r.missing, 0),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet([...head, recapHeader, ...recapBody, [], recapTotal])
    ws1['!cols'] = [{ wch: 24 }, ...recapLayanan.map(() => ({ wch: 16 })), { wch: 16 }, { wch: 16 }, { wch: 16 }]

    // Sheet 2 — every visit of the period (current filters applied)
    const detailCols: { header: string; width: number; value: (r: Row, i: number) => Cell }[] = [
      { header: 'No',               width: 5,  value: (_, i) => i + 1 },
      { header: 'Tanggal',          width: 12, value: (r) => dateCell(r.visit_date) },
      { header: 'Jam',              width: 7,  value: (r) => r.visit_time ?? '' },
      { header: 'Nama Layanan',     width: 28, value: (r) => r.layanan ?? '' },
      { header: 'Kategori Layanan', width: 20, value: (r) => r.kategori ?? '' },
      { header: 'Nama Pasien',      width: 26, value: (r) => r.patient_name },
      { header: 'No. RM',           width: 14, value: (r) => r.no_rm ?? '' },
      { header: 'Terapis',          width: 20, value: (r) => r.therapist_name ?? '' },
      { header: 'Status Kehadiran', width: 15, value: (r) => kehadiranLabel(r.kehadiran) },
      { header: 'Status Jadwal',    width: 13, value: (r) => VISIT_STATUS_LABEL[r.status] ?? r.status },
      { header: 'Status Bayar',     width: 13, value: (r) => r.payment_status ?? 'Belum Bayar' },
      { header: 'Order ID',         width: 16, value: (r) => r.order_id ?? '' },
      { header: 'Fee Terapis',      width: 14, value: (r) => (r.paid ? (r.fee == null ? 'Tarif belum diatur' : money(r.fee)) : '') },
    ]
    const detailHead: Cell[][] = [
      ['Detail Kunjungan Sport Massage'],
      ['Cabang', branchName],
      ['Periode gaji', `${data.start} s/d ${data.end}`],
      ['Filter', filtered ? [q.trim() && `"${q.trim()}"`, therapist && therapistOptions?.find((t) => t.id === therapist)?.name, service, kehadiran && KEHADIRAN_OPTIONS.find((k) => k.value === kehadiran)?.label].filter(Boolean).join(' · ') : 'Tidak ada'],
      [],
    ]
    const detailBody = visible.map((r, i) => detailCols.map((c) => c.value(r, i)))
    const feeTotal: Cell[] = detailCols.map((c) => (c.header === 'No' ? 'TOTAL' : c.header === 'Fee Terapis' ? money(visibleFee) : null))
    const ws2 = XLSX.utils.aoa_to_sheet([...detailHead, detailCols.map((c) => c.header), ...detailBody, [], feeTotal])
    ws2['!cols'] = detailCols.map((c) => ({ wch: c.width }))
    ws2['!autofilter'] = {
      ref: XLSX.utils.encode_range({ r: detailHead.length, c: 0 }, { r: detailHead.length + detailBody.length, c: detailCols.length - 1 }),
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Rekap Terapis')
    XLSX.utils.book_append_sheet(wb, ws2, 'Detail Kunjungan')
    XLSX.writeFile(wb, `payroll-sport-massage_${slug(branchName)}_${data.start}_${data.end}.xlsx`, { compression: true })
    showToast('Payroll sport massage diekspor', 'success')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Payroll Sport Massage — {branchName}</h1>
            <p className="text-sm text-muted-foreground">Periode gaji {periodLabel} · {rangeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canSwitchBranch && branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Cabang"
              className={`${CONTROL} cursor-pointer`}
            >
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <MonthPicker month={period.month} year={period.year} onChange={(month, year) => setPeriod({ month, year })} />
          {data?.canEditRates && (
            <button
              onClick={() => setRatesOpen(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
            >
              <BadgeDollarSign size={15} />
              <span className="hidden sm:inline">Atur Tarif</span>
            </button>
          )}
          <ExportButton onExport={handleExport} disabled={!data || rows.length === 0} label="Export" />
        </div>
      </div>

      {error && (
        <div className="glass-card p-4 flex items-center justify-between gap-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => load()} className="text-xs font-semibold underline cursor-pointer shrink-0">Coba lagi</button>
        </div>
      )}

      {!data && !error ? (
        <SkeletonRegion>
          <TableSkeleton rows={6} cols={5} />
        </SkeletonRegion>
      ) : data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<Activity size={18} />} label="Sesi Hadir" value={paidRows.length.toLocaleString('id-ID')} />
            <Stat icon={<Wallet size={18} />} label="Total Fee" value={formatRp(totalFee)} />
            <Stat icon={<Users size={18} />} label="Terapis Aktif" value={`${recap.filter((r) => r.sessions > 0).length} dari ${recap.length}`} />
            <Stat icon={<AlertTriangle size={18} />} label="Kehadiran Belum Diisi" value={unmarked.toLocaleString('id-ID')} warn={unmarked > 0} />
          </div>

          {missingRate > 0 && (
            <div className="glass-card p-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                {missingRate} sesi hadir belum punya tarif fee (dihitung Rp 0).
                {data.canEditRates ? ' Klik "Atur Tarif" untuk melengkapi.' : ' Minta manajer/direktur melengkapi tarif.'}
              </span>
            </div>
          )}

          {/* Recap per therapist */}
          <div className="glass-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground px-1">
              Rekap per Terapis <span className="text-xs font-normal text-muted-foreground">· sesi hadir · klik baris untuk lihat detail</span>
            </p>
            {recap.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Belum ada terapis sport massage di cabang ini</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Terapis</th>
                      {recapLayanan.map((l) => (
                        <th key={l.id} className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">{l.nama}</th>
                      ))}
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Total Sesi</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Total Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => { setTherapist(r.id); document.getElementById('sm-detail')?.scrollIntoView({ behavior: 'smooth' }) }}
                        className={`border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${therapist === r.id ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-3 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">{r.name}</td>
                        {recapLayanan.map((l) => (
                          <td key={l.id} className="px-3 py-2.5 text-xs text-right font-mono text-muted-foreground">{r.counts[l.id] || '—'}</td>
                        ))}
                        <td className="px-3 py-2.5 text-xs text-right font-mono text-foreground">{r.sessions}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-mono font-semibold text-foreground whitespace-nowrap">
                          {formatRp(r.fee)}
                          {r.missing > 0 && <span title={`${r.missing} sesi tanpa tarif`} className="ml-1 text-amber-500">*</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border">
                      <td className="px-3 py-2.5 text-xs font-semibold text-foreground">Total</td>
                      {recapLayanan.map((l) => (
                        <td key={l.id} className="px-3 py-2.5 text-xs text-right font-mono font-semibold text-foreground">
                          {recap.reduce((s, r) => s + r.counts[l.id], 0)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-xs text-right font-mono font-semibold text-foreground">{paidRows.length}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-mono font-semibold text-primary whitespace-nowrap">{formatRp(totalFee)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Detail kunjungan — filters */}
          <div id="sm-detail" className="glass-card relative z-20 p-4 flex flex-col lg:flex-row lg:items-center gap-2 scroll-mt-4">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari pasien, No. RM, terapis, layanan…"
                aria-label="Cari"
                className={`${CONTROL} w-full pl-8 pr-8`}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <TherapistCombobox options={therapistOptions} value={therapist} onChange={setTherapist} />
              <select aria-label="Layanan" value={service} onChange={(e) => setService(e.target.value)} className={`${CONTROL} cursor-pointer`}>
                <option value="">Semua Layanan</option>
                {serviceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select aria-label="Kehadiran" value={kehadiran} onChange={(e) => setKehadiran(e.target.value)} className={`${CONTROL} cursor-pointer`}>
                {KEHADIRAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="relative flex items-center">
                <ArrowUpDown size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
                <select aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${CONTROL} pl-8 cursor-pointer`}>
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {filtered && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setTherapist(''); setService(''); setKehadiran('') }}
                  className="h-9 px-3 text-xs font-medium rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Detail kunjungan — table */}
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs text-muted-foreground px-1">
              {filtered
                ? <>Menampilkan <b className="text-foreground">{visible.length}</b> dari {rows.length} kunjungan</>
                : <><b className="text-foreground">{rows.length}</b> kunjungan</>}
              {' · '}{patientCount} pasien · fee <b className="text-foreground">{formatRp(visibleFee)}</b>
            </p>

            {visible.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {rows.length === 0 ? 'Tidak ada jadwal sport massage pada periode ini' : 'Tidak ada data yang cocok dengan filter'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['No.', 'Tanggal', 'Jam', 'Pasien', 'Terapis', 'Layanan', 'Kategori', 'Kehadiran', 'Status', 'Fee'].map((h) => (
                        <th key={h} className={`px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap ${h === 'Fee' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r, i) => (
                      <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground w-10">{i + 1}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDay(r.visit_date)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{r.visit_time ?? '—'}</td>
                        <td className="px-3 py-2.5 min-w-40">
                          <Link
                            href={`/patients/${r.patient_id}`}
                            prefetch={false}
                            className="text-xs font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {r.patient_name}
                          </Link>
                          {r.no_rm && <p className="text-[11px] text-muted-foreground font-mono">{r.no_rm}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">
                          {r.therapist_name ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.layanan ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.kategori ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          <span className={
                            r.kehadiran === 'HADIR' ? 'text-green-500'
                            : r.kehadiran === 'TIDAK HADIR' ? 'text-destructive'
                            : 'text-muted-foreground'
                          }>
                            {kehadiranLabel(r.kehadiran)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{VISIT_STATUS_LABEL[r.status] ?? r.status}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-mono whitespace-nowrap">
                          {!r.paid ? <span className="text-muted-foreground">—</span>
                            : r.fee == null ? <span className="text-amber-500" title="Tarif belum diatur">Rp 0*</span>
                            : <span className="text-foreground">{formatRp(r.fee)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {ratesOpen && data && (
        <FeeRatesDialog
          branchId={branchId}
          layanan={data.layanan}
          therapists={data.therapists}
          rates={data.rates}
          onClose={() => setRatesOpen(false)}
          onSaved={() => { setRatesOpen(false); showToast('Tarif fee disimpan', 'success'); load() }}
        />
      )}
    </div>
  )
}

function Stat({ icon, label, value, warn = false }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${warn ? 'text-amber-500 bg-amber-500/10' : 'text-primary bg-primary/10'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-base font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}
