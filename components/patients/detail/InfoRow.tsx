import type { ReactNode } from 'react'

interface InfoRowProps {
  label: string
  value: string | null | undefined
  icon?: ReactNode
}

export function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border/40 last:border-0">
      {icon && (
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      )}
      <dt className="w-36 text-xs text-muted-foreground shrink-0 leading-5">{label}</dt>
      <dd className="text-sm text-foreground break-words flex-1">{value ?? '—'}</dd>
    </div>
  )
}
