'use client'

import { useState } from 'react'
import { Building2, Calendar, CheckCircle2, Pencil, Trash2, XCircle } from 'lucide-react'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import type { BranchTargetRow } from './types'
import { MONTHS, STATUS_LABEL, STATUS_COLOR, STATUS_BORDER } from './types'

interface Props {
  target: BranchTargetRow
  isManager: boolean
  onApprove?: (id: string) => Promise<void>
  onReject?: (id: string, note: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onEdit?: (t: BranchTargetRow) => void
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-xl p-2.5 text-center">
      <p className="text-[10px] text-muted-foreground mb-0.5 leading-tight">{label}</p>
      <p className="text-base font-bold text-foreground">{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

export function BranchTargetCard({
  target: t,
  isManager,
  onApprove,
  onReject,
  onDelete,
  onEdit,
}: Props) {
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const branchName = t.branches?.name ?? '—'
  const setByName = t.internal_profiles?.full_name ?? '—'
  const isPending = t.status === 'pending'

  async function handleApprove() {
    if (!onApprove) return
    setLoading(true)
    await onApprove(t.id)
    setLoading(false)
  }

  async function handleReject() {
    if (!onReject || !rejectNote.trim()) return
    setLoading(true)
    await onReject(t.id, rejectNote.trim())
    setLoading(false)
    setRejecting(false)
    setRejectNote('')
  }

  async function handleDelete() {
    if (!onDelete) return
    setLoading(true)
    await onDelete(t.id)
    setLoading(false)
    setDeleteConfirm(false)
  }

  return (
    <>
      <div className={`glass-card border-l-4 ${STATUS_BORDER[t.status]} p-4 space-y-3`}>
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Branch icon */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-primary" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{branchName}</p>
                <p className="text-xs text-muted-foreground">Dibuat oleh {setByName}</p>
              </div>
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[t.status]}`}
              >
                {STATUS_LABEL[t.status]}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-1.5">
              <Calendar size={11} className="text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                {MONTHS[t.bulan - 1]} {t.tahun}
              </span>
            </div>
          </div>

          {/* Action icons in header */}
          <div className="flex items-center gap-1 shrink-0">
            {isManager && isPending && onEdit && (
              <button
                onClick={() => onEdit(t)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Edit target"
              >
                <Pencil size={14} />
              </button>
            )}
            {!isManager && onDelete && (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Hapus permanen"
              >
                <Trash2 size={14} />
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

        {/* Notes */}
        {t.notes && (
          <p className="text-xs text-muted-foreground italic">&ldquo;{t.notes}&rdquo;</p>
        )}

        {/* Rejection note */}
        {t.rejection_note && (
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-xs font-medium text-destructive mb-1">Catatan Penolakan</p>
            <p className="text-sm text-foreground">{t.rejection_note}</p>
          </div>
        )}

        {/* Director approve/reject actions */}
        {!isManager && isPending && !rejecting && (
          <div className="flex gap-2 pt-1 border-t border-border/50">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-chart-4/15 text-chart-4 text-sm font-medium hover:bg-chart-4/25 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 size={14} /> Setujui
            </button>
            <button
              onClick={() => setRejecting(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-60"
            >
              <XCircle size={14} /> Tolak
            </button>
          </div>
        )}

        {/* Reject form */}
        {!isManager && isPending && rejecting && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Tulis alasan penolakan..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejecting(false); setRejectNote('') }}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectNote.trim()}
                className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                {loading ? 'Memproses...' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <ConfirmDialog
          title="Hapus Permanen"
          description={`Target cabang "${branchName}" untuk ${MONTHS[t.bulan - 1]} ${t.tahun} akan dihapus secara permanen. Lanjutkan?`}
          confirmLabel="Hapus"
          danger
          loading={loading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </>
  )
}
