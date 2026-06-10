import React from 'react'

export function ChartSkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded-lg mb-2" />
      <div className="h-3 w-60 bg-muted/60 rounded-lg mb-6" />
      <div className="flex items-end gap-3 h-80">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex-1 bg-muted rounded-t-lg" style={{ height: `${30 + (i * 7) % 70}%` }} />
        ))}
      </div>
    </div>
  )
}

export function KPISkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-3 w-24 bg-muted rounded mb-3" />
      <div className="h-7 w-32 bg-muted rounded mb-2" />
      <div className="h-3 w-16 bg-muted/60 rounded" />
    </div>
  )
}
