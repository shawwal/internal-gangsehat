const ITEMS: { c: string; label: string }[] = [
  { c: 'bg-[#34C759]/15 border-[#34C759]/40', label: 'Kosong' },
  { c: 'bg-primary/15 border-primary/40', label: 'Terjadwal' },
  { c: 'bg-[#34C759] border-[#34C759] text-white', label: 'Hadir' },
  { c: 'bg-[#FFB35C]/20 border-[#FFB35C]/50', label: 'Izin / Sakit' },
  { c: 'bg-[#FF3B30]/15 border-[#FF3B30]/50', label: 'Alpa' },
  { c: 'bg-purple-500/15 border-purple-500/50', label: 'Pengganti' },
  { c: 'bg-muted border-border opacity-60', label: 'Terapis OFF' },
]

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {ITEMS.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block w-3.5 h-3.5 rounded border ${i.c}`} />
          {i.label}
        </div>
      ))}
    </div>
  )
}
