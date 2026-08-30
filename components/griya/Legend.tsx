const ITEMS: { c: string; label: string }[] = [
  { c: 'bg-[#34C759]/5 border-dashed border-[#34C759]/70', label: 'Kosong' },
  { c: 'bg-primary/20 border-primary/60', label: 'Terjadwal' },
  { c: 'bg-[#34C759] border-[#34C759] text-white', label: 'Hadir' },
  { c: 'bg-[#FFB35C]/30 border-[#FFB35C]/70', label: 'Izin / Sakit' },
  { c: 'bg-[#FF3B30]/20 border-[#FF3B30]/70', label: 'Alpa' },
  { c: 'bg-purple-500/20 border-purple-500/70', label: 'Pengganti' },
  { c: 'bg-muted border-muted-foreground/40', label: 'Terapis OFF' },
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
