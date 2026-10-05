'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { MONTH_NAMES } from '@/lib/payroll/period'
import type { PayrollWorkspace, WorkspaceRow } from '@/lib/payroll/workspace'
import { ExportButton } from '@/components/ui/ExportButton'
import { formatIDR, formatRupiah } from './format'
import { Modal } from './Modal'

interface Props {
  ws: PayrollWorkspace
  rows: WorkspaceRow[]
}

const lineAmount = (row: WorkspaceRow, prefix: string) =>
  row.result?.lines.filter((l) => l.code.startsWith(prefix)).reduce((s, l) => s + l.amount, 0) ?? 0

/** GAJI sheet: PENDAPATAN (KLINIK, VISIT) − POTONGAN (TERLAMBAT, ALFA, DENDA) = TOTAL GAJI. */
export function RecapStep({ ws, rows }: Props) {
  const [detail, setDetail] = useState<WorkspaceRow | null>(null)

  const cols = rows.map((r) => {
    const late = lineAmount(r, 'RULE_LATE')
    const alfa = lineAmount(r, 'RULE_ALFA') + lineAmount(r, 'POTONGAN_KEHADIRAN')
    const otherRules = (r.result?.lines.filter((l) => l.kind === 'deduction' && l.code.startsWith('RULE_') && l.code !== 'RULE_LATE' && l.code !== 'RULE_ALFA')
      .reduce((s, l) => s + l.amount, 0)) ?? 0
    const adjustments = r.result?.lines.filter((l) => l.code.startsWith('ADJ_'))
      .reduce((s, l) => s + (l.kind === 'deduction' ? l.amount : -l.amount), 0) ?? 0
    return {
      row: r,
      klinik: r.result ? r.result.klinik + Math.max(0, lineAmount(r, 'POTONGAN_KEHADIRAN')) : 0,
      visit: r.result?.visit ?? 0,
      late,
      alfa: alfa + otherRules,
      denda: adjustments,
      net: r.result?.net ?? 0,
    }
  })
  const sum = (k: 'klinik' | 'visit' | 'late' | 'alfa' | 'denda' | 'net') => cols.reduce((s, c) => s + c[k], 0)
  const warnCount = rows.reduce((s, r) => s + r.warnings.length, 0)

  function handleExport() {
    type Row = (typeof cols)[number]
    const columns: ExportColumn<Row>[] = [
      { header: 'NO. KARYAWAN', value: (c) => c.row.staff.employee_no ?? '' },
      { header: 'NAMA KARYAWAN', value: (c) => c.row.staff.full_name },
      { header: 'JABATAN', value: (c) => c.row.staff.jabatan ?? '' },
      { header: 'KLINIK', value: (c) => c.klinik },
      { header: 'VISIT', value: (c) => c.visit },
      { header: 'TERLAMBAT', value: (c) => c.late },
      { header: 'ALFA', value: (c) => c.alfa },
      { header: 'DENDA', value: (c) => c.denda },
      { header: 'TOTAL GAJI', value: (c) => c.net },
    ]
    exportToExcel(cols, columns, `GAJI_${ws.period.branch_name}_${MONTH_NAMES[ws.period.period_month - 1]}_${ws.period.period_year}`)
    return Promise.resolve()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total pendapatan', value: sum('klinik') + sum('visit') },
          { label: 'Total potongan', value: sum('late') + sum('alfa') + sum('denda') },
          { label: 'Total gaji dibayar', value: sum('net'), accent: true },
          { label: 'Karyawan', value: rows.length, plain: true },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-lg font-bold mt-1 ${k.accent ? 'text-primary' : 'text-foreground'}`}>
              {k.plain ? k.value : formatRupiah(k.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {warnCount > 0 ? (
          <p className="text-xs text-secondary-foreground flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-secondary" /> {warnCount} peringatan perlu dicek sebelum dikunci.
          </p>
        ) : <span />}
        <ExportButton onExport={handleExport} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30">
              <th colSpan={3} />
              <th colSpan={2} className="px-2 py-1 text-[10px] uppercase tracking-wide text-chart-4 border-l border-border">Pendapatan</th>
              <th colSpan={3} className="px-2 py-1 text-[10px] uppercase tracking-wide text-destructive border-l border-border">Potongan</th>
              <th colSpan={2} className="border-l border-border" />
            </tr>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">No.</th>
              <th className="px-3 py-2 text-left font-medium">Karyawan</th>
              <th className="px-3 py-2 text-left font-medium">Jabatan</th>
              <th className="px-3 py-2 text-right font-medium border-l border-border">Klinik</th>
              <th className="px-3 py-2 text-right font-medium">Visit</th>
              <th className="px-3 py-2 text-right font-medium border-l border-border">Terlambat</th>
              <th className="px-3 py-2 text-right font-medium">Alfa</th>
              <th className="px-3 py-2 text-right font-medium">Denda</th>
              <th className="px-3 py-2 text-right font-semibold border-l border-border">Total Gaji</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cols.map((c) => {
              const s = c.row.staff
              return (
                <tr key={s.id} onClick={() => setDetail(c.row)} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{s.employee_no ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{s.full_name}</span>
                      {c.row.warnings.length > 0 && (
                        <span title={c.row.warnings.map((w) => w.message).join('\n')}><AlertTriangle size={12} className="text-secondary" /></span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.jabatan ?? '—'}</td>
                  {c.row.result ? (
                    <>
                      <td className="px-3 py-2 text-right border-l border-border">{formatIDR(c.klinik)}</td>
                      <td className="px-3 py-2 text-right">{formatIDR(c.visit)}</td>
                      <td className="px-3 py-2 text-right border-l border-border text-destructive">{c.late ? formatIDR(c.late) : '–'}</td>
                      <td className="px-3 py-2 text-right text-destructive">{c.alfa ? formatIDR(c.alfa) : '–'}</td>
                      <td className="px-3 py-2 text-right text-destructive">{c.denda ? formatIDR(c.denda) : '–'}</td>
                      <td className="px-3 py-2 text-right font-bold text-foreground border-l border-border">{formatIDR(c.net)}</td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-3 py-2 text-center text-destructive border-l border-border">Data kompensasi belum diisi</td>
                  )}
                  <td className="px-2 text-muted-foreground"><ChevronRight size={14} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 font-semibold text-foreground">
              <td colSpan={3} className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right border-l border-border">{formatIDR(sum('klinik'))}</td>
              <td className="px-3 py-2 text-right">{formatIDR(sum('visit'))}</td>
              <td className="px-3 py-2 text-right border-l border-border">{formatIDR(sum('late'))}</td>
              <td className="px-3 py-2 text-right">{formatIDR(sum('alfa'))}</td>
              <td className="px-3 py-2 text-right">{formatIDR(sum('denda'))}</td>
              <td className="px-3 py-2 text-right text-primary border-l border-border">{formatIDR(sum('net'))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {detail && (
        <Modal title={detail.staff.full_name} subtitle={`${detail.staff.employee_no ?? 'Tanpa no. karyawan'} · ${detail.staff.jabatan ?? detail.staff.role}`}
          onClose={() => setDetail(null)} size="lg">
          <div className="space-y-4">
            {detail.warnings.length > 0 && (
              <div className="rounded-xl bg-secondary/10 border border-secondary/30 p-3 space-y-1">
                {detail.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-secondary-foreground flex gap-1.5"><AlertTriangle size={12} className="text-secondary mt-0.5 shrink-0" />{w.message}</p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {([
                ['Hadir', detail.attendance.hadir], ['Terlambat (mnt)', detail.attendance.lateMinutes], ['Izin', detail.attendance.izin],
                ['Sakit', detail.attendance.sakit], ['Cuti', detail.attendance.cuti], ['Alfa', detail.attendance.alfa],
              ] as const).map(([l, v]) => (
                <div key={l} className="rounded-xl bg-muted/50 p-2">
                  <p className="text-base font-bold text-foreground">{v}</p>
                  <p className="text-[10px] text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
            {detail.result ? (
              <table className="w-full text-sm">
                <tbody>
                  {detail.result.lines.map((l, i) => (
                    <tr key={i} className="border-b border-border last:border-0 align-top">
                      <td className="py-2 pr-3">
                        <p className={`font-medium ${l.kind === 'deduction' ? 'text-destructive' : 'text-foreground'}`}>{l.label}</p>
                        <p className="text-[11px] text-muted-foreground">{l.detail}</p>
                      </td>
                      <td className={`py-2 text-right whitespace-nowrap font-semibold ${l.kind === 'deduction' ? 'text-destructive' : 'text-foreground'} ${l.amount === 0 ? 'opacity-40' : ''}`}>
                        {l.kind === 'deduction' ? '−' : ''}{formatRupiah(l.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-3 font-bold text-foreground">Total gaji (dibulatkan {formatIDR(ws.settings.rounding_unit)})</td>
                    <td className="pt-3 text-right font-bold text-primary text-base">{formatRupiah(detail.result.net)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-destructive">Isi data kompensasi karyawan ini di Pengaturan Penggajian.</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Ada yang tidak sesuai? Perbaiki data sumbernya (absensi, aktivitas, atau penyesuaian) — angka akan dihitung ulang otomatis.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
