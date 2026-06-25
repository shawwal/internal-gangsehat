import type { ElementType } from 'react'

interface StatCardProps {
  label:   string
  value:   number
  icon:    ElementType
  color:   string
  loading?: boolean
}

export function StatCard({ label, value, icon: Icon, color, loading }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {loading
          ? <div className="h-6 w-8 bg-muted animate-pulse rounded mt-0.5" />
          : <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        }
      </div>
    </div>
  )
}
