import type { DiscountPreset } from './types'

export const DISCOUNT_PRESETS: DiscountPreset[] = [
  { label: 'Normal', pct: 0 },
  { label: '5%', pct: 5 },
  { label: '10%', pct: 10 },
  { label: '15%', pct: 15 },
  { label: 'Custom', pct: null },
]

export const PAYMENT_METHODS = [
  'Tunai',
  'Non Tunai - BCA',
  'Non Tunai - Mandiri',
  'Non Tunai - BRI',
  'Non Tunai - BNI',
  'Non Tunai - BSI',
  'Non Tunai - GoPay',
  'Non Tunai - OVO',
  'Non Tunai - QRIS',
]

export const DRAFT_STORAGE_KEY = 'order-draft-v1'

export const inputCls =
  'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-shadow'

export const labelCls = 'block text-xs font-medium text-foreground mb-1.5'
