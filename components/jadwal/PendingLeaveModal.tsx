import { AlertCircle, X } from 'lucide-react'
import type { PendingLeaveInfo } from './types'

export interface LeavePopoverState {
  staffName: string
  leave: PendingLeaveInfo
}

interface PendingLeaveModalProps {
  state: LeavePopoverState
  canApprove: boolean
  saving: boolean
  onClose: () => void
  onAction: (leaveId: string, action: 'approve' | 'reject') => void
}

export function PendingLeaveModal({ state, canApprove, saving, onClose, onAction }: PendingLeaveModalProps) {
  const { staffName, leave } = state
  const dateRange = leave.start_date === leave.end_date
    ? leave.start_date
    : `${leave.start_date} – ${leave.end_date}`

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="glass-card w-full max-w-sm pointer-events-auto shadow-2xl">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                <AlertCircle size={15} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Pengajuan Cuti
                </p>
                <p className="text-sm font-semibold text-foreground">{staffName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground shrink-0"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-3">
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground w-20 shrink-0">Tanggal</span>
              <span className="text-foreground font-medium">{dateRange}</span>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground w-20 shrink-0">Alasan</span>
              <span className="text-foreground">
                {leave.reason || <span className="italic text-muted-foreground">—</span>}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border/30 space-y-2">
            {canApprove ? (
              <div className="flex gap-2">
                <button
                  onClick={() => onAction(leave.id, 'reject')}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  Tolak
                </button>
                <button
                  onClick={() => onAction(leave.id, 'approve')}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#34C759] text-white text-sm font-medium hover:bg-[#34C759]/90 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Setujui'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-1">
                Hanya HR, Manager, atau Director yang dapat menyetujui cuti.
              </p>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl text-xs text-muted-foreground hover:bg-white/5 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
