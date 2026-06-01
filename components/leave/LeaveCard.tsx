'use client'

import { useState } from 'react'
import { Building2, Calendar, Check, CheckCircle2, Clock, Trash2, XCircle } from 'lucide-react'
import { ProofDialog } from './ProofDialog'
import { ConfirmDialog } from './ConfirmDialog'
import type { LeaveRow } from './types'
import { STATUS_LABEL, STATUS_COLOR, STATUS_BORDER, formatDate, dayCount } from './types'

interface Props {
  leave: LeaveRow
  isSelected?: boolean
  onToggle?: (id: string) => void
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, note: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function LeaveCard({ leave, isSelected, onToggle, onApprove, onReject, onDelete }: Props) {
  const [rejecting, setRejecting]         = useState(false)
  const [rejectNote, setRejectNote]       = useState('')
  const [loading, setLoading]             = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const name     = leave.internal_profiles?.full_name ?? '—'
  const email    = leave.internal_profiles?.email ?? ''
  const branch   = leave.branches?.name ?? '—'
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const days     = dayCount(leave.start_date, leave.end_date)
  const isPending = leave.status === 'pending'

  async function handleApprove() {
    setLoading(true)
    await onApprove(leave.id)
    setLoading(false)
  }

  async function handleReject() {
    if (!rejectNote.trim()) return
    setLoading(true)
    await onReject(leave.id, rejectNote.trim())
    setLoading(false)
    setRejecting(false)
    setRejectNote('')
  }

  async function handleDelete() {
    setLoading(true)
    await onDelete(leave.id)
    setLoading(false)
    setDeleteConfirm(false)
  }

  return (
    <>
      <div className={`glass-card border-l-4 ${STATUS_BORDER[leave.status]} p-4 space-y-3 transition-all ${
        isSelected ? 'ring-2 ring-primary/40 bg-primary/5' : ''
      }`}>
        {/* Top row — avatar, name, meta, status, delete */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          {onToggle && (
            <button
              onClick={() => onToggle(leave.id)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                isSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/60'
              }`}
            >
              {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
            </button>
          )}

          {/* Avatar */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{initials}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{name}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[leave.status]}`}>
                  {STATUS_LABEL[leave.status]}
                </span>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Hapus permanen"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 size={11} /> {branch}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar size={11} />
                {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
                <span className="text-primary font-medium ml-1">({days} hari)</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} /> {formatDate(leave.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Reason — always visible */}
        <p className="text-sm text-foreground leading-relaxed pl-0">{leave.reason}</p>

        {/* Proof — always visible */}
        {leave.proof_url && <ProofDialog url={leave.proof_url} />}

        {/* Rejection note — always visible */}
        {leave.rejection_note && (
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-xs font-medium text-destructive mb-1">Catatan Penolakan</p>
            <p className="text-sm text-foreground">{leave.rejection_note}</p>
          </div>
        )}

        {/* Action buttons — always visible for pending */}
        {isPending && !rejecting && (
          <div className="flex gap-2 pt-1 border-t border-border/40">
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
        {isPending && rejecting && (
          <div className="space-y-2 pt-1 border-t border-border/40">
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
          description={`Data izin "${name}" akan dihapus secara permanen termasuk file bukti. Tindakan ini tidak dapat dibatalkan.`}
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
