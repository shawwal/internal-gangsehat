import { effectiveStatus, type PaymentLinkView } from './types'

const STYLES: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Menunggu',    cls: 'bg-[#FFB35C]/15 text-[#FFB35C]' },
  paid:      { label: 'Lunas',       cls: 'bg-[#34C759]/15 text-[#34C759]' },
  expired:   { label: 'Kedaluwarsa', cls: 'bg-white/10 text-muted-foreground' },
  failed:    { label: 'Gagal',       cls: 'bg-destructive/15 text-destructive' },
  cancelled: { label: 'Dibatalkan',  cls: 'bg-white/10 text-muted-foreground line-through' },
}

export function PaymentLinkStatusBadge({ link }: { link: Pick<PaymentLinkView, 'status' | 'expires_at'> }) {
  const s = STYLES[effectiveStatus(link)] ?? STYLES.pending
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function MethodBadge({ method }: { method: 'QRIS' | 'VA' }) {
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold ${
      method === 'QRIS' ? 'bg-primary/15 text-primary' : 'bg-sky-500/15 text-sky-400'
    }`}>
      {method}
    </span>
  )
}
