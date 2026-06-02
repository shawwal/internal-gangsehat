interface Props {
  title: string
  description?: string
  children: React.ReactNode
}

export function SettingsSection({ title, description, children }: Props) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className={description ? 'mb-4' : 'mb-3'}>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
