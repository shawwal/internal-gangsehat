// Body skeleton for /director/overview — shared by the route's loading.tsx
// (first load) and the page's keyed <Suspense> (branch / month / year changes,
// which don't re-trigger loading.tsx because only searchParams change).
export function OverviewBodySkeleton() {
  return (
    <>
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
    </>
  )
}
