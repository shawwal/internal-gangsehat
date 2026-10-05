import type { PayrollPeriodStatus } from '@/lib/payroll/types'

/** "Rp 10.000.000" */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

/** "10.000.000" */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount)
}

/** 1_500_000 → "1 juta 500 ribu"; 0 → "" */
export function toHumanIDR(amount: number): string {
  if (amount <= 0) return ''
  const juta = Math.floor(amount / 1_000_000)
  const ribu = Math.floor((amount % 1_000_000) / 1_000)
  const sisa = amount % 1_000
  const parts: string[] = []
  if (juta > 0) parts.push(`${juta} juta`)
  if (ribu > 0) parts.push(`${ribu} ribu`)
  if (parts.length === 0 && sisa > 0) parts.push(`${sisa}`)
  return parts.join(' ')
}

export const STATUS_STYLE: Record<PayrollPeriodStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-secondary/20 text-secondary-foreground',
  locked: 'bg-primary/10 text-primary',
  paid: 'bg-chart-4/15 text-chart-4',
}

export const CODE_STYLE: Record<string, string> = {
  H: 'bg-chart-4/15 text-chart-4',
  I: 'bg-primary/10 text-primary',
  S: 'bg-muted text-foreground/70',
  C: 'bg-chart-5/15 text-chart-5',
  A: 'bg-destructive/15 text-destructive',
  LATE: 'bg-secondary/25 text-secondary-foreground',
}
