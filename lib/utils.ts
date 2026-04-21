export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  // Parse date-only strings as local time to avoid UTC offset shifting the day
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + 'T00:00:00')
    : new Date(date)
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatWaNumber(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  if (clean.startsWith('62')) return clean
  return clean
}
