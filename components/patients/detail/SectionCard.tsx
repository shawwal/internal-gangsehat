import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  icon: ReactNode
  children: ReactNode
  action?: ReactNode
}

export function SectionCard({ title, icon, children, action }: SectionCardProps) {
  return (
    <div className="glass-card p-5 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      <dl className="space-y-0">{children}</dl>
    </div>
  )
}
