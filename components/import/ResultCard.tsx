import { CheckCircle2, Info, AlertCircle } from 'lucide-react'
import type { ImportResult } from './types'

interface ResultCardProps {
  result: ImportResult
}

export function ResultCard({ result }: ResultCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">
        Hasil Import — sheet &quot;{result.sheetUsed}&quot;
      </h2>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-chart-4/10 text-chart-4 text-sm font-medium">
          <CheckCircle2 size={14} />
          Berhasil: {result.imported}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/20 text-secondary-foreground text-sm font-medium">
          <Info size={14} />
          Dilewati: {result.skipped}
        </div>
        {result.errors > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
            <AlertCircle size={14} />
            Error: {result.errors}
          </div>
        )}
      </div>
    </div>
  )
}
