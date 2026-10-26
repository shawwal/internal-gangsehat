'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { AlertTriangle, List, RefreshCw, RotateCcw } from 'lucide-react'
import { getPayrollActivityDetail } from '@/app/actions/payroll'
import { MetricDetailModal } from '@/components/metrics/MetricDetailModal'
import { activityDisplay, sortActivityTypes } from '@/lib/payroll/activityDisplay'
import { incentiveConfigIssue } from '@/lib/payroll/engine'
import { staffDisplayName, type PayrollWorkspace, type WorkspaceRow } from '@/lib/payroll/workspace'
import { formatIDR } from './format'
import { btn } from './Modal'
import { avgOf, belowAvgTest, BELOW_AVG_CLS, formatStat, sumOf } from '@/lib/tableStats'

interface Props {
  ws: PayrollWorkspace
  rows: WorkspaceRow[]
  refreshing: boolean
  onRefresh: () => void
  onOverride: (staffId: string, code: string, value: number | null) => void
}

const isAuto = (t: { count_mode: string; from_payments?: boolean }) => t.count_mode !== 'manual' || !!t.from_payments

const insentifOf = (row: WorkspaceRow) => row.result?.lines.find((l) => l.code === 'INSENTIF')?.amount ?? 0

// One table per role: columns, totals and below-average marks only compare like with like.
const ROLE_GROUPS = [
  { key: 'admin', label: 'Admin', roles: ['admin'] },
  { key: 'sport_massage', label: 'Terapis Sport Massage', roles: ['sport_massage_therapist'] },
  { key: 'therapist', label: 'Fisioterapis', roles: ['therapist'] },
]
const GROUPED_ROLES = new Set(ROLE_GROUPS.flatMap((g) => g.roles))

type Detail = { staffId: string; name: string; code: string; label: string }

export function ActivityStep({ ws, rows, refreshing, onRefresh, onOverride }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [detail, setDetail] = useState<Detail | null>(null)
  const editable = ws.permissions.canEdit
  const paymentLabels = ws.activityTypes.filter((t) => t.from_payments).map((t) => activityDisplay(t).label)

  const sections = useMemo(() => {
    const out = ROLE_GROUPS.map((g) => ({ key: g.key, label: g.label, rows: rows.filter((r) => g.roles.includes(r.staff.role)) }))
    out.push({ key: 'other', label: 'Lainnya', rows: rows.filter((r) => !GROUPED_ROLES.has(r.staff.role)) })
    return out.filter((g) => g.rows.length > 0)
  }, [rows])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-2xl">
          Angka otomatis diambil dari kunjungan pasien yang <b>hadir</b> (Jadwal Harian) dalam periode ini.
          {paymentLabels.length > 0 && (
            <> Kolom {paymentLabels.join(', ')} diambil dari pembayaran <b>LUNAS / PELUNASAN</b> per Layanan, atas nama Fisio di pembayaran.</>
          )}
          {' '}Ketik angka untuk mengoreksi; kosongkan untuk kembali ke nilai otomatis.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btn.ghost} onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Sembunyikan kolom kosong' : 'Tampilkan semua aktivitas'}
          </button>
          {editable && (
            <button className={btn.secondary} onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Tarik ulang data sesi
            </button>
          )}
        </div>
      </div>

      {sections.map((g) => (
        <section key={g.key} className="space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground">
            {g.label} <span className="text-xs font-normal text-muted-foreground">· {g.rows.length} karyawan</span>
          </h3>
          <ActivityTable
            ws={ws}
            rows={g.rows}
            showAll={showAll}
            editable={editable}
            drafts={drafts}
            setDrafts={setDrafts}
            onOverride={onOverride}
            onDetail={setDetail}
          />
        </section>
      ))}
      {detail && (
        <MetricDetailModal
          title={`${detail.label} — ${detail.name}`}
          subtitle="Pasien & tanggal yang dihitung otomatis pada periode ini"
          load={() => getPayrollActivityDetail(ws.period.id, detail.staffId, detail.code)}
          onClose={() => setDetail(null)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Kolom kuning = dikoreksi manual · merah berbingkai = melebihi batas wajar · merah penuh = di bawah rata-rata kolom · kolom pudar = tidak dipakai di skema gaji karyawan tsb.
      </p>
    </div>
  )
}

interface TableProps {
  ws: PayrollWorkspace
  rows: WorkspaceRow[]
  showAll: boolean
  editable: boolean
  drafts: Record<string, string>
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>
  onOverride: Props['onOverride']
  onDetail: (d: Detail) => void
}

function ActivityTable({ ws, rows, showAll, editable, drafts, setDrafts, onOverride, onDetail }: TableProps) {
  // Columns: types somebody in this group is paid on (incentive codes / rates) or that have data.
  const columns = useMemo(() => {
    const used = new Set<string>()
    for (const { staff: s } of rows) {
      s.compensation?.incentive_activity_codes.forEach((c) => used.add(c))
      Object.entries(s.compensation?.activity_rates ?? {}).forEach(([c, v]) => { if (v) used.add(c) })
      Object.entries(ws.activity[s.id] ?? {}).forEach(([c, cell]) => { if ((cell.override ?? cell.auto) > 0) used.add(c) })
    }
    return sortActivityTypes(ws.activityTypes.filter((t) => showAll || used.has(t.code)))
      .map((t) => ({ ...t, ...activityDisplay(t) }))
  }, [ws, rows, showAll])

  const groups = useMemo(() => {
    const out: { label: string; span: number }[] = []
    for (const c of columns) {
      const last = out[out.length - 1]
      if (last && last.label === c.group) last.span++
      else out.push({ label: c.group, span: 1 })
    }
    return out
  }, [columns])

  const activityValue = (staffId: string, code: string) => {
    const cell = ws.activity[staffId]?.[code]
    return cell?.override ?? cell?.auto ?? 0
  }

  // Red cell = below the column's Rata-rata (all columns here are "higher is better").
  const activityBelowAvg = new Map(columns.map((t) => [t.code, belowAvgTest(rows.map((r) => activityValue(r.staff.id, t.code)))]))
  const insentifBelowAvg = belowAvgTest(rows.map(insentifOf))
  const visitBelowAvg = belowAvgTest(rows.map((r) => r.result?.visit ?? 0))

  function commit(staffId: string, code: string, raw: string, auto: number) {
    const k = `${staffId}|${code}`
    setDrafts((d) => { const next = { ...d }; delete next[k]; return next })
    const trimmed = raw.trim()
    if (trimmed === '') return onOverride(staffId, code, null)
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return
    onOverride(staffId, code, n === auto ? null : n)
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="text-xs border-collapse min-w-full">
        <thead>
          <tr className="bg-muted/30">
            <th className="sticky left-0 z-10 bg-muted" />
            {groups.map((g, i) => (
              <th key={i} colSpan={g.span} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary border-l border-border">{g.label}</th>
            ))}
            <th colSpan={3} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary border-l border-border">Hasil</th>
          </tr>
          <tr className="bg-muted/50 border-b border-border">
            <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium text-muted-foreground min-w-[110px] sm:min-w-[150px]">Karyawan</th>
            {columns.map((t) => (
              <th key={t.code} className="px-2 py-2 text-center font-medium text-muted-foreground border-l border-border min-w-[78px] whitespace-nowrap" title={t.code}>
                {t.label}
                <div className="text-[9px] font-normal opacity-70">{isAuto(t) ? 'otomatis' : 'manual'}</div>
              </th>
            ))}
            <th className="px-2 py-2 text-center font-medium text-muted-foreground border-l border-border">Capaian</th>
            <th className="px-2 py-2 text-right font-medium text-muted-foreground">Insentif</th>
            <th className="px-2 py-2 text-right font-medium text-muted-foreground">Bonus Visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const s = row.staff
            const comp = s.compensation
            const insentif = insentifOf(row)
            const incentiveIssue = comp ? incentiveConfigIssue(comp) : null
            return (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border">
                  <div className="font-medium text-foreground truncate max-w-[140px]" title={s.full_name}>{staffDisplayName(s)}</div>
                  <div className="text-[10px] text-muted-foreground">{s.jabatan ?? s.role}</div>
                </td>
                {columns.map((t) => {
                  const cell = ws.activity[s.id]?.[t.code]
                  const auto = cell?.auto ?? 0
                  const value = cell?.override ?? auto
                  const k = `${s.id}|${t.code}`
                  const over = value > t.max_per_period
                  const relevant = comp?.incentive_activity_codes.includes(t.code) || !!comp?.activity_rates[t.code]
                  return (
                    <td key={t.code} className={`px-1 py-1 text-center border-l border-border ${relevant ? '' : 'opacity-50'}`}>
                      <input
                        inputMode="numeric"
                        disabled={!editable}
                        value={drafts[k] ?? String(value)}
                        aria-label={`${s.full_name} ${t.label}`}
                        onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value.replace(/[^\d]/g, '') }))}
                        onBlur={(e) => { if (drafts[k] !== undefined) commit(s.id, t.code, e.target.value, auto) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        onFocus={(e) => e.target.select()}
                        title={over ? `Melebihi batas wajar (${t.max_per_period})` : undefined}
                        className={`w-14 h-7 rounded-md text-center font-semibold border focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-default ${
                          over ? 'border-destructive bg-destructive/10 text-destructive'
                            : cell?.override != null ? 'border-secondary bg-secondary/10 text-foreground'
                            : 'border-transparent bg-muted/40 text-foreground'
                        } ${!over && activityBelowAvg.get(t.code)!(value) ? BELOW_AVG_CLS : ''}`}
                      />
                      {s.branch_total_codes?.includes(t.code) && (
                        <div className="text-[9px] text-muted-foreground">total cabang</div>
                      )}
                      {isAuto(t) && auto > 0 && (
                        <button
                          onClick={() => onDetail({ staffId: s.id, name: staffDisplayName(s), code: t.code, label: t.label })}
                          title="Lihat pasien & tanggal"
                          aria-label={`Rincian ${t.label} ${s.full_name}`}
                          className="mx-auto flex items-center gap-0.5 text-[9px] text-primary hover:underline"
                        >
                          <List size={9} /> rincian
                        </button>
                      )}
                      {cell?.override != null && (
                        <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground mt-0.5">
                          oto: {auto}
                          {editable && (
                            <button title="Kembalikan ke otomatis" onClick={() => onOverride(s.id, t.code, null)} className="hover:text-primary">
                              <RotateCcw size={9} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 text-center border-l border-border text-muted-foreground whitespace-nowrap">
                  {comp && comp.incentive_target > 0 ? `${row.result?.incentiveQty ?? 0}/${comp.incentive_target}` : '—'}
                  {incentiveIssue && (
                    <div title={incentiveIssue} className="flex items-center justify-center gap-0.5 text-[9px] text-destructive">
                      <AlertTriangle size={9} /> aktivitas belum dipilih
                    </div>
                  )}
                </td>
                <td className={`px-2 text-right font-semibold text-foreground whitespace-nowrap ${insentifBelowAvg(insentif) ? BELOW_AVG_CLS : ''}`}>{formatIDR(insentif)}</td>
                <td className={`px-2 text-right font-semibold text-foreground whitespace-nowrap ${visitBelowAvg(row.result?.visit ?? 0) ? BELOW_AVG_CLS : ''}`}>{formatIDR(row.result?.visit ?? 0)}</td>
              </tr>
            )
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="border-t-2 border-border bg-muted/30 font-semibold text-foreground">
            {(['Jumlah', 'Rata-rata'] as const).map((label) => {
              const stat = label === 'Jumlah' ? sumOf : avgOf
              return (
                <tr key={label} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border">{label}</td>
                  {columns.map((t) => (
                    <td key={t.code} className="px-1 py-1.5 text-center border-l border-border">
                      {formatStat(stat(rows.map((r) => activityValue(r.staff.id, t.code))))}
                    </td>
                  ))}
                  <td className="border-l border-border" />
                  <td className="px-2 text-right whitespace-nowrap">{formatIDR(Math.round(stat(rows.map(insentifOf))))}</td>
                  <td className="px-2 text-right whitespace-nowrap">{formatIDR(Math.round(stat(rows.map((r) => r.result?.visit ?? 0))))}</td>
                </tr>
              )
            })}
          </tfoot>
        )}
      </table>
    </div>
  )
}
