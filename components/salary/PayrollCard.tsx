'use client'

import { useState } from 'react'
import { User, Building2, Calendar, CheckCircle2, CreditCard, Pencil, Trash2, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import type { PayrollRecord } from './types'
import {
  PAYROLL_STATUS_LABEL,
  PAYROLL_STATUS_COLOR,
  PAYROLL_STATUS_BORDER,
  ROLE_LABELS,
  MONTHS,
  formatRupiah,
  calcNet,
} from './types'
import { generatePayrollInvoice } from './generateInvoice'

interface Props {
  record: PayrollRecord
  isManager: boolean
  onConfirm?: (id: string) => Promise<void>
  onMarkPaid?: (id: string) => Promise<void>
  onEdit?: (r: PayrollRecord) => void
  onDelete?: (id: string) => Promise<void>
}

function SalaryRow({
  label,
  value,
  bold,
  negative,
}: {
  label: string
  value: number
  bold?: boolean
  negative?: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'pt-2 mt-1 border-t border-border/50' : ''}`}>
      <span className={`text-xs ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-sm font-medium ${bold ? 'text-foreground' : negative ? 'text-destructive' : 'text-foreground'}`}>
        {negative ? `(${formatRupiah(value)})` : formatRupiah(value)}
      </span>
    </div>
  )
}

export function PayrollCard({ record: r, isManager, onConfirm, onMarkPaid, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const staffName = r.internal_profiles?.full_name ?? '—'
  const staffRole = r.internal_profiles?.role ? (ROLE_LABELS[r.internal_profiles.role] ?? r.internal_profiles.role) : '—'
  const branchName = r.branches?.name ?? '—'
  const net = calcNet(r)

  async function doConfirm() {
    if (!onConfirm) return
    setLoading(true)
    await onConfirm(r.id)
    setLoading(false)
  }

  async function doMarkPaid() {
    if (!onMarkPaid) return
    setLoading(true)
    await onMarkPaid(r.id)
    setLoading(false)
  }

  async function doDelete() {
    if (!onDelete) return
    setLoading(true)
    await onDelete(r.id)
    setLoading(false)
    setDeleteConfirm(false)
  }

  return (
    <>
      <div className={`glass-card border-l-4 ${PAYROLL_STATUS_BORDER[r.status]} p-4 space-y-3`}>
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User size={16} className="text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{staffName}</p>
                <p className="text-xs text-muted-foreground">{staffRole}</p>
              </div>
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${PAYROLL_STATUS_COLOR[r.status]}`}>
                {PAYROLL_STATUS_LABEL[r.status]}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1">
                <Building2 size={10} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{branchName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={10} className="text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {MONTHS[r.period_month - 1]} {r.period_year}
                </span>
              </div>
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 shrink-0">
            {r.status === 'draft' && onEdit && (
              <button
                onClick={() => onEdit(r)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
            )}
            {r.status === 'draft' && onDelete && (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Hapus"
              >
                <Trash2 size={14} />
              </button>
            )}
            {/* Invoice button — visible once confirmed or paid */}
            {(r.status === 'confirmed' || r.status === 'paid') && (
              <button
                onClick={() => generatePayrollInvoice(r)}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                title="Cetak slip gaji"
              >
                <FileText size={14} />
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title={expanded ? 'Sembunyikan rincian' : 'Lihat rincian'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Net total — always visible */}
        <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Total Gaji Bersih</span>
          <span className="text-base font-bold text-foreground">{formatRupiah(net)}</span>
        </div>

        {/* Salary breakdown — collapsible */}
        {expanded && (
          <div className="space-y-1.5 bg-muted/20 rounded-xl p-3">
            <SalaryRow label="Gaji Pokok"            value={r.base_salary} />
            <SalaryRow label="Tunjangan Transport"   value={r.transport_allowance} />
            <SalaryRow label="Tunjangan Makan"       value={r.meal_allowance} />
            {r.other_allowance > 0 && (
              <SalaryRow label="Tunjangan Lainnya" value={r.other_allowance} />
            )}
            {r.bonus_achievement > 0 && (
              <SalaryRow label="Bonus Pencapaian" value={r.bonus_achievement} />
            )}
            {r.deductions > 0 && (
              <SalaryRow label="Potongan" value={r.deductions} negative />
            )}
            <SalaryRow label="Total Bersih" value={net} bold />
          </div>
        )}

        {/* Notes */}
        {r.notes && (
          <p className="text-xs text-muted-foreground italic">&ldquo;{r.notes}&rdquo;</p>
        )}

        {/* Director actions */}
        {!isManager && r.status === 'draft' && onConfirm && (
          <div className="pt-1 border-t border-border/50">
            <button
              onClick={doConfirm}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary/20 text-secondary-foreground text-sm font-medium hover:bg-secondary/30 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 size={14} /> Konfirmasi
            </button>
          </div>
        )}

        {!isManager && r.status === 'confirmed' && onMarkPaid && (
          <div className="pt-1 border-t border-border/50">
            <button
              onClick={doMarkPaid}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-chart-4/15 text-chart-4 text-sm font-medium hover:bg-chart-4/25 transition-colors disabled:opacity-60"
            >
              <CreditCard size={14} /> Tandai Dibayar
            </button>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <ConfirmDialog
          title="Hapus Record Penggajian"
          description={`Hapus record gaji ${staffName} untuk ${MONTHS[r.period_month - 1]} ${r.period_year}?`}
          confirmLabel="Hapus"
          danger
          loading={loading}
          onConfirm={doDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </>
  )
}
