type Row = [string, string]
type Block = { heading: string; meta: string; status: string; groups: { title?: string; rows: Row[] }[]; empty?: string }

const PAGE_W = 210
const PAGE_H = 297
const M = 15
const CONTENT_W = PAGE_W - M * 2
const PRIMARY: [number, number, number] = [255, 0, 144]
const MUTED: [number, number, number] = [110, 110, 110]
const TEXT: [number, number, number] = [25, 25, 25]

// Builds the Griya Anak rekam medis as a text-based (vector) PDF with jsPDF's
// built-in Helvetica — no screenshots, no embedded fonts — so the file stays a
// few dozen KB and the text is selectable/searchable.
export async function downloadGriyaRekamMedisPdf(opts: {
  patientName: string
  noRm: string | null
  blocks: Block[]
  filename: string
}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = M

  const ensure = (h: number) => {
    if (y + h > PAGE_H - M - 6) { doc.addPage(); y = M }
  }
  const lines = (text: string, w: number, size: number) => {
    doc.setFontSize(size)
    return doc.splitTextToSize(text, w) as string[]
  }

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...TEXT)
  doc.text(`Rekam Medis — ${opts.patientName}`, M, y + 5)
  y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED)
  doc.text(`${opts.noRm ? `No. RM ${opts.noRm} · ` : ''}${opts.blocks.length} catatan · Griya Anak Gang Sehat`, M, y)
  y += 3
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.6); doc.line(M, y, PAGE_W - M, y)
  y += 7

  for (const b of opts.blocks) {
    ensure(18)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TEXT)
    doc.text(b.heading, M, y)
    const hw = doc.getTextWidth(b.heading)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text(`[${b.status}]`, M + hw + 2, y)
    y += 4.5
    doc.text(b.meta, M, y)
    y += 2
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(M, y, PAGE_W - M, y)
    y += 5

    if (b.empty) {
      doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(b.empty, M, y); y += 8
      continue
    }

    for (const g of b.groups) {
      if (g.title) {
        ensure(10)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PRIMARY)
        doc.text(g.title, M, y); y += 4.5
      }
      for (const [label, value] of g.rows) {
        const labelW = 48
        doc.setFont('helvetica', 'normal')
        const vl = lines(value, CONTENT_W - labelW, 9.5)
        const lh = 4.4
        ensure(vl.length * lh + 1)
        doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(label, M, y)
        doc.setFontSize(9.5); doc.setTextColor(...TEXT); doc.text(vl, M + labelW, y, { lineHeightFactor: 1.3 })
        y += vl.length * lh + 1.2
      }
      y += 2
    }
    y += 4
  }

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text(`${opts.patientName}${opts.noRm ? ` · ${opts.noRm}` : ''}`, M, PAGE_H - 8)
    doc.text(`Halaman ${i} / ${total}`, PAGE_W - M, PAGE_H - 8, { align: 'right' })
  }

  doc.save(opts.filename)
}

export type { Block as GriyaPdfBlock }
