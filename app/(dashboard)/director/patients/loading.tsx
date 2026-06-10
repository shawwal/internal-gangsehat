import { ArrowLeft } from 'lucide-react'

export default function PatientAnalyticsLoading() {
  return (
    <div className="space-y-6 relative">
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-muted/60 flex items-center justify-center">
          <ArrowLeft size={16} className="text-foreground/30" />
        </div>
        <div className="space-y-1.5">
          <div className="h-6 w-40 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Filter controls skeleton */}
      <div className="flex justify-end gap-2">
        <div className="h-9 w-36 bg-muted rounded-2xl animate-pulse" />
        <div className="h-9 w-20 bg-muted rounded-2xl animate-pulse" />
        <div className="h-9 w-20 bg-muted rounded-2xl animate-pulse" />
      </div>

      {/* Period badge skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-28 bg-muted rounded-2xl animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card h-24 animate-pulse rounded-3xl" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card h-72 animate-pulse rounded-3xl" />
        <div className="glass-card h-72 animate-pulse rounded-3xl" />
      </div>
      <div className="glass-card h-64 animate-pulse rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card h-64 animate-pulse rounded-3xl" />
        <div className="glass-card h-64 animate-pulse rounded-3xl" />
      </div>
    </div>
  )
}
