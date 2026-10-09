// Server-side PDF receipt (kwitansi) for a paid DOKU payment link — the
// permanent proof stored in the private `payment-receipts` bucket. DOKU
// Checkout has no downloadable invoice and its hosted page isn't permanent.

import { jsPDF } from 'jspdf'
import { channelLabel } from './channels'

export interface ReceiptData {
  invoiceNumber: string
  branchName: string
  branchAddress: string | null
  branchPhone: string | null
  patientName: string
  noRm: string | null
  category: string
  description: string | null
  amount: number
  harga: number
  discount: number
  channel: string | null
  reference: string | null
  paidAt: string
  environment: 'development' | 'production'
}

const rp = (n: number) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))}`
const jktDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + ' WIB'

/** Object path of a receipt inside the `payment-receipts` bucket. */
export function receiptPath(invoiceNumber: string, paidAt: string): string {
  const d = new Date(paidAt)
  return `doku/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${invoiceNumber}.pdf`
}

export function buildReceiptPdf(r: ReceiptData): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const W = doc.internal.pageSize.getWidth()
  const L = 14
  const R = W - 14
  let y = 18

  if (r.environment === 'development') {
    doc.setTextColor(235, 235, 235)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(48)
    doc.text('SANDBOX', W / 2, 120, { align: 'center', angle: 30 })
  }

  doc.setTextColor(17, 17, 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Fisioterapi Gang Sehat', L, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  y += 4.5
  doc.text(r.branchName, L, y)
  if (r.branchAddress) {
    for (const line of doc.splitTextToSize(r.branchAddress, R - L - 45) as string[]) { y += 4; doc.text(line, L, y) }
  }
  if (r.branchPhone) { y += 4; doc.text(r.branchPhone, L, y) }

  doc.setTextColor(255, 0, 144)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('KWITANSI', R, 18, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  doc.setFont('helvetica', 'normal')
  doc.text(r.invoiceNumber, R, 23, { align: 'right' })

  y = Math.max(y, 26) + 6
  doc.setDrawColor(255, 0, 144)
  doc.setLineWidth(0.5)
  doc.line(L, y, R, y)
  y += 8

  const row = (label: string, value: string) => {
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), L, y)
    doc.setFontSize(9.5); doc.setTextColor(17, 17, 17); doc.setFont('helvetica', 'bold')
    const lines = doc.splitTextToSize(value || '—', R - L - 42) as string[]
    doc.text(lines, L + 42, y)
    y += Math.max(lines.length, 1) * 5 + 2
  }

  row('Diterima dari', r.patientName + (r.noRm ? ` (${r.noRm})` : ''))
  row('Untuk', r.category + (r.description ? ` — ${r.description}` : ''))
  row('Waktu bayar', jktDateTime(r.paidAt))
  row('Metode', `DOKU · ${channelLabel(r.channel)}`)
  if (r.reference) row('Referensi', r.reference)

  y += 2
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.2)
  doc.line(L, y, R, y)
  y += 7

  const money = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 11 : 9)
    doc.setTextColor(bold ? 17 : 90, bold ? 17 : 90, bold ? 17 : 90)
    doc.text(label, L, y)
    doc.text(value, R, y, { align: 'right' })
    y += bold ? 7 : 5.5
  }
  if (r.harga > 0 && r.harga !== r.amount) money('Harga', rp(r.harga))
  if (r.discount > 0) money('Diskon', `- ${rp(r.discount)}`)
  money('Dibayar', rp(r.amount), true)

  y += 4
  doc.setFillColor(52, 199, 89)
  doc.roundedRect(L, y, 28, 8, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('LUNAS', L + 14, y + 5.4, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(140, 140, 140)
  const H = doc.internal.pageSize.getHeight()
  doc.text(
    'Kwitansi ini dibuat otomatis oleh sistem setelah pembayaran dikonfirmasi oleh DOKU.',
    W / 2, H - 12, { align: 'center' },
  )
  doc.text(`Dicetak ${jktDateTime(new Date().toISOString())}`, W / 2, H - 8, { align: 'center' })

  return doc.output('arraybuffer')
}
