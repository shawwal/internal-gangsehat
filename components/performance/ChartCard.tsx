'use client'

import React from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function ChartCard({ title, subtitle, children, action, className = '' }: ChartCardProps) {
  return (
    <div className={`glass-card p-5 ${className}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0 ml-3">{action}</div>}
      </div>
      {children}
    </div>
  )
}
