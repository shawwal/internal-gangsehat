// Payment channels offered on a DOKU Checkout page, per link method.
// Shared by client and server (no secrets).

export type PaymentLinkMethod = 'QRIS' | 'VA'

export const QRIS_TYPES = ['QRIS']

// BCA VA is still being activated on the merchant — add 'VIRTUAL_ACCOUNT_BCA'
// here (or via DOKU_VA_CHANNELS) once DOKU enables it.
export const DEFAULT_VA_TYPES = [
  'VIRTUAL_ACCOUNT_BANK_MANDIRI',
  'VIRTUAL_ACCOUNT_BRI',
  'VIRTUAL_ACCOUNT_BNI',
  'VIRTUAL_ACCOUNT_BANK_PERMATA',
  'VIRTUAL_ACCOUNT_BANK_CIMB',
  'VIRTUAL_ACCOUNT_BANK_DANAMON',
  'VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI',
  'VIRTUAL_ACCOUNT_DOKU',
]

export function paymentMethodTypes(method: PaymentLinkMethod, vaOverride?: string | null): string[] {
  if (method === 'QRIS') return QRIS_TYPES
  const custom = (vaOverride ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return custom.length ? custom : DEFAULT_VA_TYPES
}

/** Default lifetime: QRIS is shown at the desk (short), VA is paid later from a bank app. */
export const DEFAULT_DUE_MINUTES: Record<PaymentLinkMethod, number> = {
  QRIS: 30,
  VA: 24 * 60,
}

/** transactions.payment_method value for a paid link. */
export const TRANSACTION_METHOD: Record<PaymentLinkMethod, string> = {
  QRIS: 'DOKU QRIS',
  VA: 'DOKU VA',
}

const CHANNEL_LABELS: Record<string, string> = {
  QRIS: 'QRIS',
  VIRTUAL_ACCOUNT_BCA: 'VA BCA',
  VIRTUAL_ACCOUNT_BANK_MANDIRI: 'VA Mandiri',
  VIRTUAL_ACCOUNT_BRI: 'VA BRI',
  VIRTUAL_ACCOUNT_BNI: 'VA BNI',
  VIRTUAL_ACCOUNT_BANK_PERMATA: 'VA Permata',
  VIRTUAL_ACCOUNT_BANK_CIMB: 'VA CIMB Niaga',
  VIRTUAL_ACCOUNT_BANK_DANAMON: 'VA Danamon',
  VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI: 'VA BSI',
  VIRTUAL_ACCOUNT_DOKU: 'VA DOKU',
  VIRTUAL_ACCOUNT_BTN: 'VA BTN',
  VIRTUAL_ACCOUNT_BNC: 'VA BNC',
}

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return '—'
  return CHANNEL_LABELS[channel] ?? channel.replace(/_/g, ' ')
}
