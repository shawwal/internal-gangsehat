import { Pencil, Trash2 } from 'lucide-react'
import type { PackageSession } from '@/types'

interface SessionListProps {
  sessions:       PackageSession[] | null
  loading:        boolean
  onEdit:         (s: PackageSession) => void
  onDelete:       (s: PackageSession) => void
  canDelete:      boolean
}

// Empty kehadiran is NOT "Tidak Hadir": a scheduled visit is still upcoming,
// and a completed one was closed without attendance being recorded (pre
// "Tandai Hadir" flow). Neither consumes quota.
function attendance(s: PackageSession) {
  if (s.kehadiran === 'HADIR') {
    return { label: 'HADIR', dot: 'bg-[#34C759]', text: 'text-muted-foreground', seqLabel: '', hint: undefined }
  }
  if (s.kehadiran === 'TIDAK HADIR') {
    return { label: 'TIDAK HADIR', dot: 'bg-destructive', text: 'text-muted-foreground', seqLabel: 'Tidak memotong kuota', hint: undefined }
  }
  if (s.status === 'scheduled') {
    return { label: 'TERJADWAL', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', seqLabel: 'Belum berlangsung', hint: undefined }
  }
  return {
    label: 'BELUM DICATAT', dot: 'bg-[#FFB35C]', text: 'text-[#FFB35C]', seqLabel: 'Tidak memotong kuota',
    hint: 'Kunjungan selesai tanpa catatan kehadiran — edit sesi untuk mengatur Hadir / Tidak Hadir.',
  }
}

export function SessionList({ sessions, loading, onEdit, onDelete, canDelete }: SessionListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-3 py-2.5 animate-pulse">
            <div className="h-3 bg-muted rounded w-20" />
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Belum ada sesi yang tercatat untuk paket ini
      </p>
    )
  }

  // `sessions` is already ordered oldest-first (fetchPackageSessions sorts by
  // visit_date ascending). Only HADIR rows consume quota (see
  // patient_packages_with_stats, migration 098), so only they get a
  // "Pertemuan N" number — TIDAK HADIR / unrecorded rows would otherwise push
  // the numbering past the package size (e.g. Pertemuan 22 of 20).
  let attendedSeq = 0
  const rows = sessions.map((s) => ({
    s,
    att:  attendance(s),
    seq:  s.kehadiran === 'HADIR' ? ++attendedSeq : null,
  }))

  return (
    <div className="divide-y divide-border">
      {rows.map(({ s, att, seq }, i) => (
        <div key={s.id} className={`px-3 py-2 text-xs ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground shrink-0">
              {new Date(s.visit_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
            </span>
            <span className="text-foreground font-medium truncate flex-1 text-center">{s.service_type}</span>
            <span className="shrink-0 flex items-center gap-1" title={att.hint}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${att.dot}`} />
              <span className={att.text}>{att.label}</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground/60 text-[10px] font-medium shrink-0">
                {seq !== null ? `Pertemuan ${seq}` : att.seqLabel}
              </span>
              <span className="text-muted-foreground/60 text-[10px] truncate">
                · {s.therapist_name ?? 'Terapis tidak tercatat'}
              </span>
              {s.shift && (
                <span className="text-[10px] text-muted-foreground/60 shrink-0">· {s.shift}</span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onEdit(s)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit sesi"
              >
                <Pencil size={11} />
              </button>
              {canDelete && (
                <button
                  onClick={() => onDelete(s)}
                  className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Hapus sesi"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
