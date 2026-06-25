export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function sessionBarColor(remaining: number, total: number): string {
  if (total === 0) return 'bg-muted'
  if (remaining === 0) return 'bg-destructive'
  if (remaining <= 2) return 'bg-[#FFB35C]'
  return 'bg-[#34C759]'
}

export function sessionTextColor(remaining: number): string {
  if (remaining === 0) return 'text-destructive'
  if (remaining <= 2) return 'text-[#FFB35C]'
  return 'text-[#34C759]'
}
