import { Loader2 } from 'lucide-react'
import { PHASE_LABEL } from './types'
import type { Progress } from './types'

interface ProgressBlockProps {
  uploading: boolean
  progress: Progress | null
  pct: number
}

export function ProgressBlock({ uploading, progress, pct }: ProgressBlockProps) {
  if (!uploading) return null

  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/40 rounded-xl">
        <Loader2 size={14} className="animate-spin shrink-0" />
        Mengunggah file...
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 bg-muted/40 rounded-xl">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 size={12} className="animate-spin shrink-0" />
          {PHASE_LABEL[progress.phase]}
        </span>
        {progress.phase === 'importing' && progress.total > 0 && (
          <span className="text-foreground font-medium tabular-nums">{pct}%</span>
        )}
      </div>

      {progress.phase === 'importing' && progress.total > 0 && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">{progress.message}</p>

      {progress.phase === 'importing' && (
        <div className="flex gap-4 text-xs tabular-nums">
          <span className="text-chart-4 font-medium">✓ {progress.imported} berhasil</span>
          <span className="text-muted-foreground">↷ {progress.skipped} dilewati</span>
          {progress.errors > 0 && (
            <span className="text-destructive">✕ {progress.errors} error</span>
          )}
        </div>
      )}
    </div>
  )
}
