import type { PackageSession } from '@/types'

interface SessionListProps {
  sessions:       PackageSession[] | null
  loading:        boolean
}

export function SessionList({ sessions, loading }: SessionListProps) {
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
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-muted-foreground/60 text-[10px]">
              {s.therapist_name ?? 'Terapis tidak tercatat'}
            </span>
            {s.shift && (
              <span className="text-[10px] text-muted-foreground/60">· {s.shift}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
