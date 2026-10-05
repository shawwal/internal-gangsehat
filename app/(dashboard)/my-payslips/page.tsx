'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, ReceiptText } from 'lucide-react'
import { getMyPayslips } from '@/app/actions/payroll'
import { visibleSlipLines } from '@/lib/payroll/engine'
import { MONTH_NAMES } from '@/lib/payroll/period'
import { downloadSlipPdf } from '@/lib/payroll/slipPdf'
import type { SlipRecord, WorkspaceSettings } from '@/lib/payroll/workspace'
import { formatRupiah } from '@/components/payroll/format'
import { btn } from '@/components/payroll/Modal'
import { CardListSkeleton } from '@/components/ui/Skeleton'

const FALLBACK_HEADER = { clinic_name: 'Fisioterapi Gang Sehat', clinic_address: '', clinic_contact: '' }

export default function MyPayslipsPage() {
  const [slips, setSlips] = useState<SlipRecord[] | null>(null)
  const [headers, setHeaders] = useState<Record<string, WorkspaceSettings>>({})
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    getMyPayslips().then((res) => {
      if (!res.ok) { setError(res.error); setSlips([]); return }
      setSlips(res.data.slips)
      setHeaders(res.data.headers)
      setOpenId(res.data.slips[0]?.id ?? null)
    })
  }, [])

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <ReceiptText size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Slip Gaji Saya</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Slip muncul setelah penggajian disetujui. PDF dikunci dengan No. Karyawan Anda.
          </p>
        </div>
      </div>

      {slips === null ? <CardListSkeleton count={3} /> : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : slips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Belum ada slip gaji.
        </div>
      ) : (
        <div className="space-y-3">
          {slips.map((s) => {
            const open = openId === s.id
            const lines = visibleSlipLines(s.lines)
            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30" onClick={() => setOpenId(open ? null : s.id)}>
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">{MONTH_NAMES[s.period_month - 1]} {s.period_year}</p>
                      <p className="text-[11px] text-muted-foreground">{s.start_date} s/d {s.end_date}</p>
                    </div>
                  </div>
                  <p className="font-bold text-primary">{formatRupiah(s.net)}</p>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                      {([
                        ['Hadir', s.attendance_summary.hadir], ['Telat (mnt)', s.attendance_summary.lateMinutes], ['Izin', s.attendance_summary.izin],
                        ['Sakit', s.attendance_summary.sakit], ['Cuti', s.attendance_summary.cuti], ['Alfa', s.attendance_summary.alfa],
                      ] as const).map(([l, v]) => (
                        <div key={l} className="rounded-xl bg-muted/50 p-2">
                          <p className="text-sm font-bold text-foreground">{v}</p>
                          <p className="text-[10px] text-muted-foreground">{l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="divide-y divide-border">
                      {lines.map((l, i) => (
                        <div key={i} className="flex justify-between gap-3 py-2 text-sm">
                          <span className={l.kind === 'deduction' ? 'text-destructive pl-3' : 'text-foreground'}>{l.label}</span>
                          <span className={`font-medium ${l.kind === 'deduction' ? 'text-destructive' : 'text-foreground'}`}>
                            {l.kind === 'deduction' ? '−' : ''}{formatRupiah(l.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground">Catatan: {s.notes}</p>}
                    <div className="flex justify-end">
                      <button className={btn.primary}
                        onClick={() => downloadSlipPdf(s, headers[s.period_id] ?? FALLBACK_HEADER, { password: s.employee_no })}>
                        <Download size={14} /> Unduh PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
