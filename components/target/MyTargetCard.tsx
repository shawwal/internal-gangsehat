'use client'

import { CheckCircle2, Clock, Pencil, XCircle } from 'lucide-react'
import type { TargetRow } from './types'
import { MONTHS, STATUS_LABEL, STATUS_COLOR, STATUS_BORDER } from './types'

interface Props {
  target: TargetRow
  onEdit: (t: TargetRow) => void
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
      <p className="text-[10px] text-muted-foreground mb-0.5 leading-tight">{label}</p>
      <p className="text-base font-bold text-foreground">{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:  <Clock size={12} className="text-secondary-foreground" />,
  approved: <CheckCircle2 size={12} className="text-chart-4" />,
  rejected: <XCircle size={12} className="text-destructive" />,
}

export function MyTargetCard({ target: t, onEdit }: Props) {
  return (
    <div className={`glass-card border-l-4 ${STATUS_BORDER[t.status]} p-4 space-y-3`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {MONTHS[t.bulan - 1]} {t.tahun}
          </p>
          {t.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">"{t.notes}"</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[t.status]}`}>
            {STATUS_ICON[t.status]}
            {STATUS_LABEL[t.status]}
          </span>
          {t.status === 'pending' && (
            <button
              onClick={() => onEdit(t)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Edit target"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-4 gap-2">
        <MetricBox label="Target TA" value={t.target_ta} />
        <MetricBox label="Paket Klinik" value={t.target_paket_klinik} />
        <MetricBox label="Kunjungan" value={t.target_kunjungan} />
        <MetricBox label="Visit" value={t.target_visit} />
      </div>

      {/* Rejection note */}
      {t.rejection_note && (
        <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
          <p className="text-xs font-medium text-destructive mb-1">Catatan Penolakan</p>
          <p className="text-sm text-foreground">{t.rejection_note}</p>
        </div>
      )}
    </div>
  )
}
