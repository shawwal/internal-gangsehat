import { Pencil, Trash2 } from 'lucide-react'
import type { PackageSession } from '@/types'

interface SessionListProps {
  sessions:       PackageSession[] | null
  loading:        boolean
  onEdit:         (s: PackageSession) => void
  onDelete:       (s: PackageSession) => void
  canDelete:      boolean
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

  return (
    <div className="divide-y divide-border">
      {sessions.map((s, i) => (
        <div key={s.id} className={`px-3 py-2 text-xs ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground shrink-0">
              {new Date(s.visit_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
            </span>
            <span className="text-foreground font-medium truncate flex-1 text-center">{s.service_type}</span>
            <span className="shrink-0 flex items-center gap-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.kehadiran === 'HADIR' ? 'bg-[#34C759]' : 'bg-destructive'}`} />
              <span className="text-muted-foreground">{s.kehadiran ?? '—'}</span>
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/60 text-[10px]">
                {s.therapist_name ?? 'Terapis tidak tercatat'}
              </span>
              {s.shift && (
                <span className="text-[10px] text-muted-foreground/60">· {s.shift}</span>
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
