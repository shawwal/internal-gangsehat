export function GridSkeleton() {
  return (
    <div className="glass-card p-4 space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <div className="w-16 h-10 rounded-lg bg-muted animate-pulse shrink-0" />
          {Array.from({ length: 6 }).map((_, j) => (
            <div key={j} className="flex-1 h-10 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
