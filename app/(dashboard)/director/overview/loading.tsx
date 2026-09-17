export default function OverviewLoading() {
  return (
    <div className="space-y-6 relative">
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <div className="h-6 w-28 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-44 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-9 w-36 bg-muted rounded-xl animate-pulse" />
          <div className="h-9 w-32 bg-muted rounded-xl animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card h-24 animate-pulse rounded-3xl" />
        ))}
      </div>

      {/* Charts */}
      <div className="glass-card h-72 animate-pulse rounded-3xl" />
      <div className="glass-card h-64 animate-pulse rounded-3xl" />

      {/* Pending lists */}
      <div className="glass-card h-48 animate-pulse rounded-3xl" />
      <div className="glass-card h-48 animate-pulse rounded-3xl" />
    </div>
  )
}
