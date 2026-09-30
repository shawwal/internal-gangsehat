import type { CSSProperties, ReactNode } from 'react'

// Shared loading-skeleton primitives. Server-safe (no hooks) so they can be
// used both in route-level `loading.tsx` files and in client pages while
// their data is being fetched.

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`bg-muted rounded-lg animate-pulse ${className}`} style={style} />
}

/** Wrapper that announces the loading state to screen readers. */
export function SkeletonRegion({ children, className = 'space-y-6' }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">Memuat...</span>
      {children}
    </div>
  )
}

export function PageHeaderSkeleton({
  actions = 1, back = false, subtitle = true,
}: { actions?: number; back?: boolean; subtitle?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {back && <Skeleton className="w-9 h-9 rounded-2xl shrink-0" />}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-40" />
          {subtitle && <Skeleton className="h-4 w-60" />}
        </div>
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className={`h-9 rounded-xl ${i === actions - 1 ? 'w-28' : 'w-24'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-2.5 w-20 bg-muted rounded-full" />
        <div className="w-9 h-9 rounded-2xl bg-muted" />
      </div>
      <div className="h-6 w-24 bg-muted rounded-full mb-1" />
      <div className="h-2.5 w-32 bg-muted/60 rounded-full" />
    </div>
  )
}

export function StatCardsSkeleton({
  count = 4, className = 'grid grid-cols-2 lg:grid-cols-4 gap-4',
}: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
  )
}

export function FiltersSkeleton({ count = 3, search = true }: { count?: number; search?: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {search && <Skeleton className="h-9 w-full sm:w-64 rounded-xl" />}
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-32 rounded-xl" />
      ))}
    </div>
  )
}

export function TabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded-xl" />
      ))}
    </div>
  )
}

// Varying widths so rows don't look like a solid block.
const CELL_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-14']

/** `<tr>` rows only — drop inside an existing `<tbody>`. */
export function TableRowsSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} aria-hidden className="border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className={`h-3.5 bg-muted rounded animate-pulse ${CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Standalone table card (header row + body rows). */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex gap-4 px-4 py-3 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1"><Skeleton className="h-3 w-16" /></div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1">
              <Skeleton className={`h-3.5 max-w-full ${CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Plain divided rows with no container — for use inside an existing card. */
export function RowsSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-busy="true" className="divide-y divide-border">
      <span className="sr-only">Memuat...</span>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} aria-hidden className="flex gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1">
              <Skeleton className={`h-3.5 max-w-full ${CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Stacked list of cards (leave requests, notifications, campaigns...). */
export function CardListSkeleton({ count = 5, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 flex items-center gap-4 animate-pulse">
          {avatar && <div className="w-10 h-10 rounded-2xl bg-muted shrink-0" />}
          <div className="flex-1 space-y-2 min-w-0">
            <div className={`h-3.5 bg-muted rounded ${i % 2 ? 'w-40' : 'w-56'} max-w-full`} />
            <div className={`h-3 bg-muted/60 rounded ${i % 2 ? 'w-64' : 'w-48'} max-w-full`} />
          </div>
          <div className="h-6 w-20 bg-muted rounded-full shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Responsive grid of cards (branches, campaigns, products...). */
export function CardGridSkeleton({
  count = 6, className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', height = 'h-40',
}: { count?: number; className?: string; height?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`glass-card p-5 animate-pulse flex flex-col gap-3 ${height}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-muted shrink-0" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="h-3 w-full bg-muted/60 rounded" />
          <div className="h-3 w-2/3 bg-muted/60 rounded" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded-lg mb-2" />
      <div className="h-3 w-56 bg-muted/60 rounded-lg mb-6" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex-1 bg-muted rounded-t-lg" style={{ height: `${28 + (i * 7) % 72}%` }} />
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton({ fields = 6, columns = 2 }: { fields?: number; columns?: 1 | 2 }) {
  return (
    <div className="glass-card p-6 space-y-5 animate-pulse">
      <div className="h-4 w-36 bg-muted rounded" />
      <div className={`grid gap-4 ${columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-muted/70 rounded" />
            <div className="h-10 w-full bg-muted rounded-xl" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <div className="h-9 w-24 bg-muted rounded-xl" />
        <div className="h-9 w-28 bg-muted rounded-xl" />
      </div>
    </div>
  )
}

/** Label/value detail card (patient profile, order detail...). */
export function DetailCardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="glass-card p-6 animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-muted shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-3 w-32 bg-muted/60 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 w-20 bg-muted/60 rounded" />
            <div className={`h-3.5 bg-muted rounded ${i % 2 ? 'w-32' : 'w-44'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Time-slot schedule grid (jadwal harian, griya jadwal, week views). */
export function ScheduleGridSkeleton({ rows = 10, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card p-4 space-y-2 overflow-hidden">
      <div className="flex gap-2 mb-1">
        <div className="w-16 shrink-0" />
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="flex-1 h-6" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="w-16 h-10 shrink-0" />
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={`flex-1 h-10 rounded-lg animate-pulse ${(i + j) % 3 === 0 ? 'bg-muted' : 'bg-muted/40'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Centered block for full-screen auth-style pages. */
export function CenteredCardSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div role="status" aria-busy="true" className="min-h-screen flex items-center justify-center p-4">
      <span className="sr-only">Memuat...</span>
      <div className="glass-card w-full max-w-md p-8 space-y-5 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-muted mx-auto" />
        <div className="space-y-2 flex flex-col items-center">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-3 w-64 bg-muted/60 rounded" />
        </div>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-muted/70 rounded" />
            <div className="h-10 w-full bg-muted rounded-xl" />
          </div>
        ))}
        <div className="h-10 w-full bg-muted rounded-xl" />
      </div>
    </div>
  )
}
