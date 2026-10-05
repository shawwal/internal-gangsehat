'use client'

import { useState } from 'react'
import { Download, FileText, Lock } from 'lucide-react'
import { visibleSlipLines } from '@/lib/payroll/engine'
import { MONTH_NAMES } from '@/lib/payroll/period'
import { downloadSlipBatchPdf, downloadSlipPdf, type SlipData } from '@/lib/payroll/slipPdf'
import type { PayrollWorkspace, WorkspaceRow } from '@/lib/payroll/workspace'
import { formatRupiah } from './format'
import { btn } from './Modal'

interface Props {
  ws: PayrollWorkspace
  rows: WorkspaceRow[]
}

export function SlipsStep({ ws, rows }: Props) {
  const locked = ws.period.status === 'locked' || ws.period.status === 'paid'
  const [protect, setProtect] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // Locked → render the frozen slips; open → live preview watermarked DRAFT.
  const slips: (SlipData & { key: string })[] = locked
    ? ws.slips.map((s) => ({ ...s, key: s.staff_id ?? s.id }))
        .sort((a, b) => (a.employee_no ?? '~').localeCompare(b.employee_no ?? '~'))
    : rows.filter((r) => r.result).map((r) => ({
        key: r.staff.id,
        employee_no: r.staff.employee_no,
        full_name: r.staff.full_name,
        jabatan: r.staff.jabatan,
        period_year: ws.period.period_year,
        period_month: ws.period.period_month,
        start_date: ws.period.start_date,
        end_date: ws.period.end_date,
        lines: r.result!.lines,
        notes: r.result!.notes || null,
        net: r.result!.net,
        draft: true,
      }))

  const label = `${ws.period.branch_name}_${MONTH_NAMES[ws.period.period_month - 1]}_${ws.period.period_year}`

  async function one(s: (typeof slips)[number]) {
    setBusy(s.key)
    await downloadSlipPdf(s, ws.settings, { password: protect && locked ? s.employee_no : null })
    setBusy(null)
  }

  async function all() {
    setBusy('all')
    await downloadSlipBatchPdf(slips, ws.settings, label)
    setBusy(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground max-w-xl">
          {locked
            ? <>Slip final dari data yang dikunci. Karyawan juga dapat mengunduh slipnya sendiri di menu <b>Slip Gaji Saya</b>.</>
            : <>Pratinjau — slip final dibuat saat periode disetujui & dikunci. Baris bernilai nol tidak dicetak.</>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locked && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} className="accent-[var(--primary)]" />
              <Lock size={12} /> Kunci PDF per karyawan dengan No. Karyawan
            </label>
          )}
          <button className={btn.primary} disabled={!slips.length || busy === 'all'} onClick={all}>
            <Download size={14} /> {busy === 'all' ? 'Menyiapkan…' : `Unduh semua (${slips.length})`}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slips.map((s) => {
          const lines = visibleSlipLines(s.lines)
          return (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.employee_no ?? '—'} · {s.jabatan ?? '—'}</p>
                </div>
                <FileText size={16} className="text-primary shrink-0" />
              </div>
              <div className="mt-3 space-y-1 flex-1">
                {lines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs">
                    <span className={`truncate ${l.kind === 'deduction' ? 'text-destructive pl-2' : 'text-muted-foreground'}`}>{l.label}</span>
                    <span className={l.kind === 'deduction' ? 'text-destructive' : 'text-foreground'}>
                      {l.kind === 'deduction' ? '−' : ''}{formatRupiah(l.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Gaji diterima</p>
                  <p className="font-bold text-primary">{formatRupiah(s.net)}</p>
                </div>
                <button className={btn.secondary} disabled={busy === s.key} onClick={() => one(s)}>
                  <Download size={13} /> PDF
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
