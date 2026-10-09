import { randomBytes } from 'node:crypto'

// Invoice numbers for payment links: "GS" + YYMMDD + 8 random base32 chars,
// e.g. GS261009K3P9X2QA. The GS prefix marks our orders on the DOKU merchant
// shared with other sites; lookup is by the payment_links.invoice_number column.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newInvoiceNumber(now = new Date()): string {
  const jkt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: '2-digit', month: '2-digit', day: '2-digit',
  }).format(now).replace(/-/g, '')
  const bytes = randomBytes(8)
  let suffix = ''
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length]
  return `GS${jkt}${suffix}`
}

export const isOurInvoice = (invoice: string | null | undefined): invoice is string =>
  !!invoice && /^GS\d{6}[A-Z2-9]{8}$/.test(invoice)
