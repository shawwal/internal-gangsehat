'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpDown, Search, X } from 'lucide-react'
import { fetchTargetProgressDetail, type TargetProgressDetailRow } from '@/app/actions/targetProgress'
import { EditTransactionSheet } from '@/components/director/finance/EditTransactionSheet'
import { PAY_STATUS_BADGE, formatRp } from '@/components/director/finance/types'
import { TherapistCombobox, type TherapistOption } from '@/components/finance/TherapistServiceFilters'
import { ExportButton } from '@/components/ui/ExportButton'
import { SkeletonRegion, TableSkeleton } from '@/components/ui/Skeleton'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { DETAIL_SORT_OPTIONS, type CategoryKey, type DetailSort } from './types'

// Rows with no attributed therapist — selectable as their own filter value.
const NO_THERAPIST = 'none'

const CONTROL = 'h-9 px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors'

// "Sab 27 Sep 2026" — matches the Tanggal column of the clinic's visit log.
function formatExportDate(date: string): string {
  return new Date(date + 'T00:00:00')
    .toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .replace(',', '')
}

const fmtLong = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

const KUNJUNGAN_EXPORT_COLUMNS: ExportColumn<TargetProgressDetailRow>[] = [
  { header: 'Tanggal',          value: (r) => (r.visitDate ? formatExportDate(r.visitDate) : '') },
  { header: 'Jam',              value: (r) => r.visitTime?.slice(0, 5) },
  { header: 'No. RM',           value: (r) => r.noRm ?? '' },
  { header: 'Nama Pasien',      value: (r) => r.patientName },
  { header: 'Nama Terapis',     value: (r) => r.fisioNickname ?? r.fisioName },
  { header: 'Layanan',          value: (r) => r.serviceType },
  { header: 'Pertemuan Ke',     value: (r) => r.pertemuanKe },
  // Rows with no recorded kehadiran are past visits the target counts as attended.
  { header: 'Kehadiran',        value: (r) => (r.kehadiran === 'HADIR' ? 'Hadir' : 'Belum Dicatat') },
  { header: 'Status Kunjungan', value: (r) => r.statusKunjungan },
]

const TRANSACTION_EXPORT_COLUMNS: ExportColumn<TargetProgressDetailRow>[] = [
  { header: 'Tanggal',      value: (r) => (r.visitDate ? formatExportDate(r.visitDate) : '') },
  { header: 'No. RM',       value: (r) => r.noRm ?? '' },
  { header: 'Nama Pasien',  value: (r) => r.patientName },
  { header: 'Nama Terapis', value: (r) => r.fisioName },
  { header: 'Layanan',      value: (r) => r.serviceType },
  { header: 'Harga',        value: (r) => r.tx?.harga ?? '' },
  { header: 'Diskon',       value: (r) => r.tx?.discount ?? '' },
  { header: 'Dibayar',      value: (r) => r.tx?.amount ?? '' },
  { header: 'Metode',       value: (r) => r.tx?.payment_method ?? '' },
  { header: 'Pembayaran',   value: (r) => r.tx?.payment_status ?? '' },
  { header: 'Penjamin',     value: (r) => r.tx?.penjamin ?? '' },
]

const byText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').localeCompare(b ?? '', 'id', { sensitivity: 'base' })
const byDate = (a: TargetProgressDetailRow, b: TargetProgressDetailRow) =>
  byText(a.visitDate, b.visitDate) || byText(a.visitTime, b.visitTime)

const SORTERS: Record<DetailSort, (a: TargetProgressDetailRow, b: TargetProgressDetailRow) => number> = {
  date_asc:      byDate,
  date_desc:     (a, b) => byDate(b, a),
  patient_asc:   (a, b) => byText(a.patientName, b.patientName) || byDate(a, b),
  patient_desc:  (a, b) => byText(b.patientName, a.patientName) || byDate(a, b),
  // Unattributed rows ('—') last.
  therapist_asc: (a, b) => Number(!a.therapistId) - Number(!b.therapistId) || byText(a.fisioName, b.fisioName) || byDate(a, b),
  service_asc:   (a, b) => byText(a.serviceType, b.serviceType) || byDate(a, b),
  amount_desc:   (a, b) => (b.tx?.harga ?? 0) - (a.tx?.harga ?? 0) || byDate(a, b),
}

export interface DetailFilters {
  q: string
  therapist: string
  service: string
  /** payment_status (LUNAS / DP / …); transaction rows only */
  payment: string
  sort: DetailSort
}

interface Props {
  branchId: string
  branchName: string
  category: CategoryKey
  label: string
  start: string
  end: string
  canEdit: boolean
  initial: DetailFilters
  /** Target Progress query (branch/month/mode) to return to. */
  backQuery: string
}

/** Full-page "which patients make up this number" for a Progress Target cell. */
export function DetailView({ branchId, branchName, category, label, start, end, canEdit, initial, backQuery }: Props) {
  const [rows, setRows] = useState<TargetProgressDetailRow[] | null>(null)
  const [filters, setFilters] = useState<DetailFilters>(initial)
  const [editingRow, setEditingRow] = useState<TargetProgressDetailRow | null>(null)
  const { q, therapist, service, payment, sort } = filters
  const set = (patch: Partial<DetailFilters>) => setFilters((f) => ({ ...f, ...patch }))

  const isKunjungan = category === 'kunjungan'
  const hasTx = !!rows?.some((r) => r.tx)
  const editable = canEdit && hasTx

  const load = useCallback(() => {
    fetchTargetProgressDetail(branchId, start, category, end).then(setRows)
  }, [branchId, start, category, end])
  useEffect(() => { load() }, [load])

  // Mirror filters into the URL (no navigation) so reload / Back keep them.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    for (const [k, v] of Object.entries({ q: q.trim(), therapist, service, payment, sort: sort === 'date_asc' ? '' : sort })) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    window.history.replaceState(null, '', `?${params}`)
  }, [q, therapist, service, payment, sort])

  const therapistOptions = useMemo<TherapistOption[] | null>(() => {
    if (!rows) return null
    const byId = new Map<string, string>()
    for (const r of rows) if (r.therapistId) byId.set(r.therapistId, r.fisioName)
    const opts = [...byId].map(([id, name]) => ({ id, name, inactive: false }))
      .sort((a, b) => byText(a.name, b.name))
    if (rows.some((r) => !r.therapistId)) opts.push({ id: NO_THERAPIST, name: 'Tanpa terapis', inactive: true })
    return opts
  }, [rows])

  const serviceOptions = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.serviceType).filter((s): s is string => !!s))].sort(byText),
    [rows],
  )

  const paymentOptions = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.tx?.payment_status).filter((s): s is string => !!s))].sort(byText),
    [rows],
  )

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (rows ?? [])
      .filter((r) => !therapist || (therapist === NO_THERAPIST ? !r.therapistId : r.therapistId === therapist))
      .filter((r) => !service || r.serviceType === service)
      .filter((r) => !payment || r.tx?.payment_status === payment)
      .filter((r) => !term || [r.patientName, r.noRm, r.fisioName, r.fisioNickname, r.serviceType, r.tx?.penjamin]
        .some((v) => v?.toLowerCase().includes(term)))
      .sort(SORTERS[sort])
  }, [rows, q, therapist, service, payment, sort])

  const filtered = !!(q.trim() || therapist || service || payment)
  const patientCount = new Set(visible.map((r) => r.patientId ?? r.id)).size
  const totalHarga = visible.reduce((s, r) => s + (r.tx?.harga ?? 0), 0)
  const sortOptions = DETAIL_SORT_OPTIONS.filter((o) => o.value !== 'amount_desc' || hasTx)
  const dateLabel = start === end ? fmtLong(start) : `${fmtLong(start)} – ${fmtLong(end)}`
  const unit = isKunjungan ? 'kunjungan' : 'transaksi'

  function handleExport() {
    exportToExcel(
      visible,
      isKunjungan ? KUNJUNGAN_EXPORT_COLUMNS : TRANSACTION_EXPORT_COLUMNS,
      `${category}_${start}${start === end ? '' : `_${end}`}`,
    )
    return Promise.resolve()
  }

  function handleSaved() {
    setEditingRow(null)
    load()
  }

  const headers = [
    'No.', 'Tanggal',
    ...(isKunjungan ? ['Jam'] : []),
    'Pasien', 'Terapis', 'Layanan',
    ...(isKunjungan ? ['Pert.', 'Kehadiran', 'Status'] : []),
    ...(hasTx ? ['Harga', 'Diskon', 'Dibayar', 'Metode', 'Pembayaran'] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href={`/target-progress${backQuery ? `?${backQuery}` : ''}`}
            aria-label="Kembali ke Progress Target"
            className="mt-0.5 p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Detail {label} — {branchName}</h1>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
        </div>
        <ExportButton onExport={handleExport} disabled={!rows || visible.length === 0} label="Export" />
      </div>

      {/* Filters */}
      {/* relative z-20: .glass-card's backdrop-filter makes each card its own
          stacking context, so the therapist dropdown would sit under the table card. */}
      <div className="glass-card relative z-20 p-4 flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Cari pasien, No. RM, terapis, layanan…"
            aria-label="Cari"
            className={`${CONTROL} w-full pl-8 pr-8`}
          />
          {q && (
            <button
              type="button"
              onClick={() => set({ q: '' })}
              aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TherapistCombobox options={therapistOptions} value={therapist} onChange={(id) => set({ therapist: id })} />
          <select
            aria-label="Layanan"
            value={service}
            onChange={(e) => set({ service: e.target.value })}
            className={`${CONTROL} cursor-pointer`}
          >
            <option value="">Semua Layanan</option>
            {/* Keep a URL value selectable even if this period has no such rows. */}
            {service && !serviceOptions.includes(service) && <option value={service}>{service}</option>}
            {serviceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Payment detail only reaches roles that can read transactions. */}
          {hasTx && (
            <select
              aria-label="Pembayaran"
              value={payment}
              onChange={(e) => set({ payment: e.target.value })}
              className={`${CONTROL} cursor-pointer`}
            >
              <option value="">Semua Pembayaran</option>
              {payment && !paymentOptions.includes(payment) && <option value={payment}>{payment}</option>}
              {paymentOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <div className="relative flex items-center">
            <ArrowUpDown size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
            <select
              aria-label="Urutkan"
              value={sort}
              onChange={(e) => set({ sort: e.target.value as DetailSort })}
              className={`${CONTROL} pl-8 cursor-pointer`}
            >
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => set({ q: '', therapist: '', service: '', payment: '' })}
              className="h-9 px-3 text-xs font-medium rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {!rows ? (
        <SkeletonRegion>
          <TableSkeleton rows={10} cols={7} />
        </SkeletonRegion>
      ) : (
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground px-1">
            {filtered
              ? <>Menampilkan <b className="text-foreground">{visible.length}</b> dari {rows.length} {unit}</>
              : <><b className="text-foreground">{rows.length}</b> {unit}</>}
            {' · '}{patientCount} pasien
            {hasTx && <> · total harga <b className="text-foreground">{formatRp(totalHarga)}</b></>}
            {editable && ' · klik baris untuk edit/hapus'}
          </p>

          {visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? 'Tidak ada data pada periode ini' : 'Tidak ada data yang cocok dengan filter'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr
                      key={r.id}
                      onClick={editable && r.tx ? () => setEditingRow(r) : undefined}
                      className={`border-b border-border/40 last:border-0 transition-colors ${
                        editable && r.tx ? 'hover:bg-muted/30 cursor-pointer' : 'hover:bg-muted/20'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-xs text-muted-foreground w-10">{i + 1}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {r.visitDate ? formatExportDate(r.visitDate) : '—'}
                      </td>
                      {isKunjungan && (
                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{r.visitTime?.slice(0, 5) ?? '—'}</td>
                      )}
                      <td className="px-3 py-2.5 min-w-40">
                        {r.patientId ? (
                          <Link
                            href={`/patients/${r.patientId}`}
                            onClick={(e) => e.stopPropagation()}
                            prefetch={false}
                            className="text-xs font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {r.patientName}
                          </Link>
                        ) : (
                          <span className="text-xs font-medium text-foreground">{r.patientName}</span>
                        )}
                        {r.noRm && <p className="text-[11px] text-muted-foreground font-mono">{r.noRm}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">
                        {r.therapistId ? r.fisioName : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.serviceType ?? '—'}</td>
                      {isKunjungan && (
                        <>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground text-center">{r.pertemuanKe ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                            <span className={r.kehadiran === 'HADIR' ? 'text-green-400' : 'text-muted-foreground'}>
                              {r.kehadiran === 'HADIR' ? 'Hadir' : 'Belum Dicatat'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.statusKunjungan ?? '—'}</td>
                        </>
                      )}
                      {hasTx && (
                        <>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{formatRp(r.tx?.harga ?? 0)}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {r.tx?.discount ? formatRp(r.tx.discount) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-foreground font-mono whitespace-nowrap">{formatRp(r.tx?.amount ?? 0)}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.tx?.payment_method ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs">
                            {r.tx?.payment_status && (
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${PAY_STATUS_BADGE[r.tx.payment_status] ?? ''}`}>
                                {r.tx.payment_status}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editingRow?.tx && (
        <EditTransactionSheet
          transaction={editingRow.tx}
          open
          hideTrigger
          onOpenChange={(next) => { if (!next) setEditingRow(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
