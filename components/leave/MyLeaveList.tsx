import { CalendarOff, CalendarRange, PlusCircle, XCircle } from 'lucide-react'
import { ProofDialog } from './ProofDialog'
import { STATUS_LABEL, STATUS_COLOR, STATUS_BORDER, formatDate, dayCount } from './types'
import type { StatusFilter } from './types'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  reason: string
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
}

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

interface Props {
  requests: LeaveRow[]
  activeTab: StatusFilter
  pendingCount: number
  onTabChange: (tab: StatusFilter) => void
  onRequestLeave: () => void
}

export function MyLeaveList({ requests, activeTab, pendingCount, onTabChange, onRequestLeave }: Props) {
  const filtered = activeTab === 'all' ? requests : requests.filter(r => r.status === activeTab)

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      {requests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Cards / empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarOff size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {activeTab === 'all' ? 'Belum ada pengajuan cuti' : `Tidak ada cuti "${STATUS_LABEL[activeTab]}"`}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {activeTab === 'all'
              ? 'Klik "Ajukan Cuti" untuk memulai pengajuan pertama Anda.'
              : 'Coba pilih tab filter yang lain.'}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={onRequestLeave}
              className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle size={14} /> Ajukan Cuti
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div
              key={r.id}
              className={`glass-card border-l-4 ${STATUS_BORDER[r.status]} p-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CalendarRange size={13} className="text-muted-foreground shrink-0" />
                    <p className="text-sm font-semibold text-foreground">
                      {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    </p>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {dayCount(r.start_date, r.end_date)} hari
                    </span>
                  </div>

                  <p className="text-sm text-foreground leading-relaxed">{r.reason}</p>

                  {r.proof_url && <ProofDialog url={r.proof_url} />}

                  {r.rejection_note && (
                    <div className="flex items-start gap-2 mt-1 p-2.5 rounded-xl bg-destructive/5 border border-destructive/20">
                      <XCircle size={13} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive leading-relaxed">{r.rejection_note}</p>
                    </div>
                  )}
                </div>

                <span className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
