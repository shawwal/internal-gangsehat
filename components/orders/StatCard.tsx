interface StatCardProps {
  label: string
  value: number
  icon: React.ElementType
  color: string
}

export function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value.toLocaleString('id-ID')}</p>
      </div>
    </div>
  )
}
