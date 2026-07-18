import { Loader2 } from 'lucide-react'
import type { CommitProgress } from './types'

interface Props {
  committing: boolean
  progress: CommitProgress | null
}

export function CommitProgressBlock({ committing, progress }: Props) {
  if (!committing && !progress) return null

  const pct = progress?.total ? Math.round((progress.processed / progress.total) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {committing && <Loader2 size={12} className="animate-spin" />}
        {progress?.phase === 'checking' ? 'Memeriksa duplikat...' : `Menyimpan ${progress?.processed ?? 0}/${progress?.total ?? 0}`}
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
