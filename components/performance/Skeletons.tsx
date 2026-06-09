'use client'

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded-lg mb-2" />
      <div className="h-3 w-56 bg-muted/60 rounded-lg mb-6" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-muted rounded-t-lg"
            style={{ height: `${28 + (i * 7) % 72}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function KpiSkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded mb-3" />
      <div className="h-8 w-20 bg-muted rounded mb-3" />
      <div className="h-2 w-full bg-muted/50 rounded-full mb-2" />
      <div className="h-3 w-14 bg-muted/50 rounded" />
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-4 w-36 bg-muted rounded mb-2" />
      <div className="h-3 w-48 bg-muted/60 rounded mb-5" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <div className="h-3 w-5 bg-muted rounded shrink-0" />
            <div className="h-3 flex-1 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted/60 rounded shrink-0" />
            <div className="h-5 w-20 bg-muted/40 rounded-full shrink-0" />
            <div className="h-3 w-16 bg-muted/50 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PodiumSkeleton() {
  return (
    <div className="glass-card p-6 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded mb-6" />
      <div className="flex items-end justify-center gap-4">
        <div className="h-36 w-28 bg-muted rounded-2xl" />
        <div className="h-44 w-32 bg-muted rounded-2xl" />
        <div className="h-32 w-28 bg-muted rounded-2xl" />
      </div>
    </div>
  )
}
