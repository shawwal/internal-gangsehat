const items = [
  { bg: 'bg-blue-500/20', border: 'border-blue-400/50', label: 'Terjadwal' },
  { bg: 'bg-[#34C759]/20', border: 'border-[#34C759]/50', label: 'Selesai' },
  { bg: 'bg-destructive/20', border: 'border-destructive/50', label: 'Batal' },
  { bg: 'bg-muted/30', border: 'border-border/40', label: 'Tidak Hadir' },
] as const

export function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pb-2">
      {items.map(({ bg, border, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded border ${bg} ${border}`} />
          <span>{label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-auto">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <span>Waktu sekarang</span>
      </div>
    </div>
  )
}
