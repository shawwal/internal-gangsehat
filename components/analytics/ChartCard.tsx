import React from 'react'

interface ChartCardProps {
  title: string
  sub: string
  children: React.ReactNode
}

export function ChartCard({ title, sub, children }: ChartCardProps) {
  return (
    <div className="glass-card p-5">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  )
}
