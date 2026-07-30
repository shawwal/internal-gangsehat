export function KehadiranBadge({ kehadiran }: { kehadiran: string | null }) {
  if (!kehadiran) return <span className="text-muted-foreground">—</span>
  const isHadir = kehadiran === 'HADIR'
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        isHadir
          ? 'bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/25'
          : 'bg-destructive/15 text-destructive border border-destructive/25'
      }`}
    >
      {isHadir ? 'Hadir' : 'Tidak Hadir'}
    </span>
  )
}
