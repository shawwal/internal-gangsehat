'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchSessionTrackerRows, type SessionTrackerRow } from '@/app/actions/jadwalList'
import { ColumnFilter, applyColumnFilters, filterOptions, type SortState } from '@/components/ui/ColumnFilter'
import { ExportButton } from '@/components/ui/ExportButton'
import { SkeletonRegion, TableSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/leave/Pagination'
import { StatusBadge } from '@/components/jadwalList/StatusBadge'
import { STATUS_LABEL } from '@/components/jadwalList/types'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'

const PAGE_SIZE = 50
const CONTROL = 'h-9 px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40'

/** What happened to a booked session. */
type Outcome = 'Hadir' | 'Tidak Hadir' | 'Batal' | 'Terjadwal'
function outcomeOf(r: SessionTrackerRow): Outcome {
  if (r.visit_status === 'cancelled') return 'Batal'
  if (r.kehadiran === 'HADIR') return 'Hadir'
  if (r.kehadiran === 'TIDAK HADIR' || r.visit_status === 'no_show') return 'Tidak Hadir'
  return 'Terjadwal'
}
const OUTCOME_CLS: Record<Outcome, string> = {
  Hadir: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/25',
  'Tidak Hadir': 'bg-destructive/15 text-destructive border-destructive/25',
  Batal: 'bg-muted text-muted-foreground border-border',
  Terjadwal: 'bg-blue-500/15 text-blue-400 border-blue-400/25',
}

const COLUMNS: Record<string, (r: SessionTrackerRow) => string | number | null | undefined> = {
  tanggal:      (r) => `${r.visit_date} ${r.visit_time ?? ''}`,
  bulan:        (r) => r.visit_date.slice(0, 7),
  jam:          (r) => r.visit_time,
  pasien:       (r) => r.patient_name,
  terapis:      (r) => r.attending_staff_name,
  layanan:      (r) => r.layanan_label,
  kategori:     (r) => r.kategori,
  pertemuan:    (r) => r.pertemuan_ke,
  hasil:        outcomeOf,
  reschedule:   (r) => (r.rescheduled ? 'Ya' : 'Tidak'),
  kurang_bayar: (r) => r.kurang_bayar,
  rekam_medis:  (r) => STATUS_LABEL[r.admin_status],
}

const HEADERS: { label: string; key?: string; filter?: boolean; align?: 'right' }[] = [
  { label: 'No' },
  { label: 'Tanggal', key: 'tanggal' },
  { label: 'Bulan', key: 'bulan', filter: true },
  { label: 'Jam', key: 'jam', filter: true },
  { label: 'Pasien', key: 'pasien', filter: true },
  { label: 'Terapis', key: 'terapis', filter: true },
  { label: 'Layanan', key: 'layanan', filter: true },
  { label: 'Kategori', key: 'kategori', filter: true },
  { label: 'Pert.', key: 'pertemuan', filter: true },
  { label: 'Hasil', key: 'hasil', filter: true },
  { label: 'Reschedule', key: 'reschedule', filter: true },
  { label: 'Kurang Bayar', key: 'kurang_bayar', align: 'right' },
  { label: 'Rekam Medis', key: 'rekam_medis', filter: true },
]

const EXPORT_COLUMNS: ExportColumn<SessionTrackerRow>[] = [
  { header: 'Tanggal', value: (r) => r.visit_date },
  { header: 'Jam', value: (r) => r.visit_time ?? '' },
  { header: 'Pasien', value: (r) => r.patient_name },
  { header: 'Terapis', value: (r) => r.attending_staff_name ?? '' },
  { header: 'Layanan', value: (r) => r.layanan_label ?? '' },
  { header: 'Kategori', value: (r) => r.kategori ?? '' },
  { header: 'Pertemuan Ke', value: (r) => r.pertemuan_ke },
  { header: 'Hasil', value: outcomeOf },
  { header: 'Reschedule', value: (r) => (r.rescheduled ? 'Ya' : 'Tidak') },
  { header: 'Kurang Bayar', value: (r) => r.kurang_bayar },
  { header: 'Rekam Medis', value: (r) => STATUS_LABEL[r.admin_status] },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)
function presetRange(key: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  switch (key) {
    case 'month': return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) }
    case '3m':    return { from: iso(new Date(Date.UTC(y, m - 2, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) }
    case 'year':  return { from: `${y}-01-01`, to: `${y}-12-31` }
    default:      return { from: '2020-01-01', to: `${y + 1}-12-31` }
  }
}
const PRESETS = [
  { key: 'all', label: 'Semua' }, { key: 'year', label: 'Tahun ini' },
  { key: '3m', label: '3 bulan' }, { key: 'month', label: 'Bulan ini' },
]

/** Read-only tracker of every booked fisio + Sport Massage session: attended, no-show, cancelled, rescheduled. */
export default function ValidationCenterPage() {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchId, setBranchId] = useState<string | null>(null)
  const [isDirector, setIsDirector] = useState(false)
  const [range, setRange] = useState(() => presetRange('all'))
  const [preset, setPreset] = useState('all')
  const [reloads, setReloads] = useState(0)
  const [q, setQ] = useState('')
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [colSort, setColSort] = useState<SortState | null>({ key: 'tanggal', dir: 'desc' })
  const [page, setPage] = useState(1)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: me }, { data: list }] = await Promise.all([
        supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single(),
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
      ])
      setIsDirector(me?.role === 'director')
      setBranches(list ?? [])
      setBranchId(me?.branch_id ?? list?.[0]?.id ?? null)
    })()
  }, [])

  // Rows belong to the branch + range they were loaded for; a change shows the skeleton until the new set lands.
  const loadKey = `${branchId}|${range.from}|${range.to}|${reloads}`
  const [result, setResult] = useState<{ key: string; rows: SessionTrackerRow[] | null; error: boolean } | null>(null)
  useEffect(() => {
    if (!branchId) return
    fetchSessionTrackerRows(range.from, range.to, branchId)
      .then((r) => setResult({ key: loadKey, rows: r, error: false }))
      .catch(() => setResult({ key: loadKey, rows: null, error: true }))
  }, [branchId, range, loadKey])
  const rows = result?.key === loadKey ? result.rows : null
  const error = result?.key === loadKey && result.error
  const load = () => setReloads((n) => n + 1)

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = (rows ?? []).filter((r) => !term || [r.patient_name, r.attending_staff_name, r.layanan_label, r.kategori, r.notes]
      .some((v) => v?.toLowerCase().includes(term)))
    return applyColumnFilters(base, COLUMNS, colFilters, colSort)
  }, [rows, q, colFilters, colSort])

  const stats = useMemo(() => {
    const count = (o: Outcome) => visible.filter((r) => outcomeOf(r) === o).length
    return [
      { label: 'Booking', value: visible.length, cls: 'text-foreground' },
      { label: 'Hadir', value: count('Hadir'), cls: 'text-[#34C759]' },
      { label: 'Tidak Hadir', value: count('Tidak Hadir'), cls: 'text-destructive' },
      { label: 'Batal', value: count('Batal'), cls: 'text-muted-foreground' },
      { label: 'Reschedule', value: visible.filter((r) => r.rescheduled).length, cls: 'text-[#FFB35C]' },
      { label: 'Terjadwal', value: count('Terjadwal'), cls: 'text-blue-400' },
    ]
  }, [visible])

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const filtered = !!q.trim() || Object.values(colFilters).some((v) => v.length)

  function pickPreset(key: string) {
    setPreset(key)
    setRange(presetRange(key))
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Validation Center</h1>
          <p className="text-sm text-muted-foreground">Semua sesi Fisioterapi & Sport Massage — booking, hadir, tidak hadir, batal, reschedule</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton
            label="Export"
            disabled={visible.length === 0}
            onExport={() => { exportToExcel(visible, EXPORT_COLUMNS, `sesi_${range.from}_${range.to}`); return Promise.resolve() }}
          />
          {isDirector && branches.length > 0 && (
            <select value={branchId ?? ''} onChange={(e) => { setBranchId(e.target.value); setColFilters({}); setPage(1) }}
              className={`${CONTROL} cursor-pointer`}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.cls}`}>{rows ? s.value.toLocaleString('id-ID') : '—'}</p>
          </div>
        ))}
      </div>

      <div className="glass-card relative z-20 p-4 flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Cari pasien, terapis, layanan, catatan…"
            aria-label="Cari" className={`${CONTROL} w-full pl-8 pr-8`} />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Hapus pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => pickPreset(p.key)}
              className={`h-9 px-3 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                preset === p.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
              {p.label}
            </button>
          ))}
          <input type="date" className={CONTROL} value={range.from} aria-label="Dari"
            onChange={(e) => { setPreset(''); setRange((r) => ({ ...r, from: e.target.value })) }} />
          <input type="date" className={CONTROL} value={range.to} aria-label="Sampai"
            onChange={(e) => { setPreset(''); setRange((r) => ({ ...r, to: e.target.value })) }} />
          {filtered && (
            <button type="button" onClick={() => { setQ(''); setColFilters({}); setPage(1) }}
              className="h-9 px-3 text-xs font-medium rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer">
              Reset filter
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="glass-card p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Data gagal dimuat.</p>
          <button type="button" onClick={load} className="h-9 px-4 text-xs font-medium rounded-xl bg-primary text-primary-foreground cursor-pointer">Coba lagi</button>
        </div>
      ) : !rows ? (
        <SkeletonRegion><TableSkeleton rows={10} cols={10} /></SkeletonRegion>
      ) : (
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground px-1">
            {filtered
              ? <>Menampilkan <b className="text-foreground">{visible.length}</b> dari {rows.length} sesi</>
              : <><b className="text-foreground">{rows.length}</b> sesi</>}
            {' · '}{new Set(visible.map((r) => r.patient_id)).size} pasien
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {HEADERS.map((h) => (
                    <th key={h.label} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                      <ColumnFilter
                        label={h.label}
                        align={h.align}
                        sortKey={h.key}
                        sort={colSort}
                        onSort={(s) => { setColSort(s); setPage(1) }}
                        options={h.filter && h.key ? filterOptions(rows, (r) => String(COLUMNS[h.key!](r) ?? '—')) : undefined}
                        selected={h.key ? colFilters[h.key] : undefined}
                        onFilter={h.key ? (v) => { setColFilters((f) => ({ ...f, [h.key!]: v })); setPage(1) } : undefined}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr><td colSpan={HEADERS.length} className="py-12 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? 'Tidak ada sesi pada rentang ini' : 'Tidak ada sesi yang cocok dengan filter'}
                  </td></tr>
                )}
                {pageRows.map((r, i) => {
                  const outcome = outcomeOf(r)
                  return (
                    <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.visit_date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.visit_date.slice(0, 7)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{r.visit_time ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-medium min-w-36">
                        <Link href={`/patients/${r.patient_id}`} prefetch={false} className="hover:text-primary hover:underline">{r.patient_name}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{r.attending_staff_name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{r.layanan_label ?? '—'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">{r.kategori ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-center text-muted-foreground">{r.pertemuan_ke}</td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${OUTCOME_CLS[outcome]}`}>{outcome}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{r.rescheduled ? <span className="text-[#FFB35C] font-medium">Ya</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-mono whitespace-nowrap">{r.kurang_bayar ? formatCurrency(r.kurang_bayar) : '—'}</td>
                      <td className="px-3 py-2.5 text-xs"><StatusBadge status={r.admin_status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {visible.length > PAGE_SIZE && (
            <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />
          )}
        </div>
      )}
    </div>
  )
}
