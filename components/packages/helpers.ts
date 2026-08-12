export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n)
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

// Legacy imports stamp package notes as "kode:TRX/2025/12/0153" to preserve a
// traceable link back to the original bookings-system order (see
// scripts/import-packages-by-phone.mts). Extract that code so it can be
// resolved to a bookings.id and linked to /order/[id].
export function extractKodeTransaksi(notes: string | null): string | null {
  const m = notes?.match(/TRX\/\d{4}\/\d{2}\/\d{4}/)
  return m ? m[0] : null
}
