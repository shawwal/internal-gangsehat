// Payslip PDF renderer (replaces the SLIP sheet). Client-side only (jsPDF).
// Renders from frozen slip data, so a locked period always reprints identically.
// Zero-value lines are stripped (spec §2.1 Module 5).

import type { jsPDF as JsPDF } from 'jspdf'
import { visibleSlipLines } from './engine'
import { MONTH_NAMES } from './period'
import type { PayrollLine } from './types'

export interface SlipHeader {
  clinic_name: string
  clinic_address: string
  clinic_contact: string
}

export interface SlipData {
  employee_no: string | null
  full_name: string
  jabatan: string | null
  period_year: number
  period_month: number
  start_date: string
  end_date: string
  lines: PayrollLine[]
  notes: string | null
  net: number
  /** Watermark for previews of a not-yet-locked period. */
  draft?: boolean
}

const rp = (n: number) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))}`
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function drawSlip(doc: JsPDF, slip: SlipData, header: SlipHeader) {
  const W = doc.internal.pageSize.getWidth()
  const L = 18
  const R = W - 18
  let y = 20

  if (slip.draft) {
    doc.setTextColor(235, 235, 235)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(70)
    doc.text('DRAFT', W / 2, 150, { align: 'center', angle: 30 })
  }

  doc.setTextColor(17, 17, 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(header.clinic_name || 'Slip Gaji', L, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(90, 90, 90)
  const addr = doc.splitTextToSize(header.clinic_address || '', R - L - 60) as string[]
  addr.forEach((line) => { y += 4.5; doc.text(line, L, y) })
  if (header.clinic_contact) { y += 4.5; doc.text(header.clinic_contact, L, y) }

  doc.setTextColor(255, 0, 144)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('SLIP GAJI', R, 22, { align: 'right' })
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.setFont('helvetica', 'normal')
  doc.text(`PERIODE ${MONTH_NAMES[slip.period_month - 1].toUpperCase()} ${slip.period_year}`, R, 28, { align: 'right' })
  doc.text(`${longDate(slip.start_date)} – ${longDate(slip.end_date)}`, R, 33, { align: 'right' })

  y = Math.max(y, 33) + 7
  doc.setDrawColor(255, 0, 144)
  doc.setLineWidth(0.6)
  doc.line(L, y, R, y)

  // Identity block
  y += 8
  const col2 = L + (R - L) / 2
  const field = (label: string, value: string, x: number, yy: number) => {
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), x, yy)
    doc.setFontSize(10); doc.setTextColor(17, 17, 17); doc.setFont('helvetica', 'bold')
    doc.text(value || '—', x, yy + 5)
  }
  field('No. Karyawan', slip.employee_no ?? '—', L, y)
  field('Jabatan', slip.jabatan ?? '—', col2, y)
  y += 13
  field('Nama Karyawan', slip.full_name, L, y)
  field('Tanggal Cetak', longDate(new Date().toISOString().slice(0, 10)), col2, y)

  // Lines table
  y += 14
  const cAmt1 = R - 42
  const cAmt2 = R
  doc.setFillColor(248, 248, 248)
  doc.rect(L, y - 5, R - L, 8, 'F')
  doc.setFontSize(8.5); doc.setTextColor(90, 90, 90); doc.setFont('helvetica', 'bold')
  doc.text('KOMPONEN', L + 2, y)
  doc.text('PENDAPATAN', cAmt1, y, { align: 'right' })
  doc.text('POTONGAN', cAmt2 - 2, y, { align: 'right' })
  y += 8

  const visible = visibleSlipLines(slip.lines)
  const earnings = visible.filter((l) => l.kind === 'earning')
  const deductions = visible.filter((l) => l.kind === 'deduction')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(17, 17, 17)
  for (const l of earnings) {
    const label = doc.splitTextToSize(l.label, cAmt1 - L - 40) as string[]
    doc.text(label, L + 2, y)
    doc.text(rp(l.amount), cAmt1, y, { align: 'right' })
    y += 6 * label.length
  }
  for (const l of deductions) {
    doc.setTextColor(200, 30, 30)
    const label = doc.splitTextToSize(l.label, cAmt1 - L - 40) as string[]
    doc.text(label, L + 6, y)
    doc.text(rp(l.amount), cAmt2 - 2, y, { align: 'right' })
    y += 6 * label.length
  }
  doc.setTextColor(17, 17, 17)

  const gross = earnings.reduce((s, l) => s + l.amount, 0)
  const ded = deductions.reduce((s, l) => s + l.amount, 0)
  y += 1
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('Total Pendapatan', L + 2, y)
  doc.text(rp(gross), cAmt1, y, { align: 'right' })
  y += 6
  doc.text('Total Potongan', L + 2, y)
  doc.setTextColor(200, 30, 30)
  doc.text(rp(ded), cAmt2 - 2, y, { align: 'right' })
  doc.setTextColor(17, 17, 17)

  y += 6
  doc.setFillColor(255, 0, 144)
  doc.roundedRect(L, y, R - L, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(11)
  doc.text('GAJI DITERIMA', L + 4, y + 7.8)
  doc.setFontSize(13)
  doc.text(rp(slip.net), R - 4, y + 8, { align: 'right' })
  doc.setTextColor(17, 17, 17)
  y += 20

  if (slip.notes) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
    doc.text('Catatan:', L, y)
    doc.setFont('helvetica', 'normal')
    const notes = doc.splitTextToSize(slip.notes, R - L) as string[]
    doc.text(notes, L, y + 5)
    y += 5 + notes.length * 4.5 + 4
  }

  y += 6
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('Penerima,', L, y)
  doc.text('Disetujui,', R - 50, y)
  y += 24
  doc.setFont('helvetica', 'bold')
  doc.text(slip.full_name, L, y)
  doc.text('HRD', R - 50, y)
}

export interface SlipPdfOptions {
  /** Encrypt with this user password (e.g. the employee number). */
  password?: string | null
}

async function newDoc(opts: SlipPdfOptions): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf')
  return new jsPDF({
    unit: 'mm',
    format: 'a4',
    ...(opts.password
      ? { encryption: { userPassword: opts.password, ownerPassword: `${opts.password}-owner-gs`, userPermissions: ['print'] as ('print')[] } }
      : {}),
  })
}

function fileSafe(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
}

export async function downloadSlipPdf(slip: SlipData, header: SlipHeader, opts: SlipPdfOptions = {}) {
  const doc = await newDoc(opts)
  drawSlip(doc, slip, header)
  doc.save(`Slip_Gaji_${fileSafe(slip.full_name)}_${slip.period_year}-${String(slip.period_month).padStart(2, '0')}.pdf`)
}

/** One PDF, one page per employee — for HR's batch print/archive. */
export async function downloadSlipBatchPdf(slips: SlipData[], header: SlipHeader, fileLabel: string, opts: SlipPdfOptions = {}) {
  if (!slips.length) return
  const doc = await newDoc(opts)
  slips.forEach((s, i) => {
    if (i > 0) doc.addPage()
    drawSlip(doc, s, header)
  })
  doc.save(`Slip_Gaji_${fileSafe(fileLabel)}.pdf`)
}
