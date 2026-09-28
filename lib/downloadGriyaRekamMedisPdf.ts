import type { PatientPlain } from '@/app/actions/patients'

type Row = [string, string]
type Block = {
  heading: string
  meta: string
  status: string
  groups: { title?: string; rows: Row[] }[]
  empty?: string
  /** Terapi Awal blocks end with a signature line, like the paper forms */
  signature?: { role: string; name: string | null }
}

const PAGE_W = 210
const PAGE_H = 297
const M = 15
const CONTENT_W = PAGE_W - M * 2
const PRIMARY: [number, number, number] = [255, 0, 144]
const MUTED: [number, number, number] = [110, 110, 110]
const TEXT: [number, number, number] = [25, 25, 25]
const LINE: [number, number, number] = [210, 210, 210]

const CLINIC = 'GRIYA ANAK GANG SEHAT'
const ADDRESS = 'Jalan Kesehatan Gang Kesehatan Dalam No.4, Pontianak, Kalimantan Barat · +62 813-4611-1417'

function ageOf(birth: string | null): string {
  if (!birth) return '-'
  const b = new Date(birth + 'T00:00:00')
  if (isNaN(b.getTime())) return '-'
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months--
  if (months < 0) return '-'
  const y = Math.floor(months / 12), m = months % 12
  return y > 0 ? `${y} th${m ? ` ${m} bln` : ''}` : `${m} bln`
}

function fmtLong(d: Date) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Builds the Griya Anak rekam medis as a text-based (vector) PDF with jsPDF's
// built-in Helvetica — no screenshots, no embedded fonts — so the file stays a
// few dozen KB and the text is selectable/searchable. Layout follows the
// clinic's paper forms: clinic header, identity block, records, signature.
export async function downloadGriyaRekamMedisPdf(opts: {
  title: string
  patient: PatientPlain
  blocks: Block[]
  filename: string
}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const p = opts.patient
  let y = M

  const ensure = (h: number) => {
    if (y + h > PAGE_H - M - 6) { doc.addPage(); y = M }
  }
  const wrap = (text: string, w: number, size: number) => {
    doc.setFontSize(size)
    return doc.splitTextToSize(text, w) as string[]
  }

  // ── Header ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...TEXT)
  doc.text(opts.title, PAGE_W / 2, y + 4, { align: 'center' })
  doc.setFontSize(10.5); doc.setTextColor(...PRIMARY)
  doc.text(CLINIC, PAGE_W / 2, y + 9.5, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text(ADDRESS, PAGE_W / 2, y + 14, { align: 'center' })
  y += 17
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.6); doc.line(M, y, PAGE_W - M, y)
  y += 5

  // ── Identity block (2 columns) ──
  const gender = p.gender === 'male' ? 'Laki-laki' : p.gender === 'female' ? 'Perempuan' : '-'
  const identity: Row[] = [
    ['No. Registrasi', p.no_rm || '-'], ['Nama', p.name || '-'],
    ['Tanggal Lahir', p.birthDate ? fmtLong(new Date(p.birthDate + 'T00:00:00')) : '-'], ['Umur', ageOf(p.birthDate)],
    ['Jenis Kelamin', gender], ['Agama', p.agama || '-'],
    ['Nama Ibu', p.nama_ibu || '-'], ['Nama Ayah', p.nama_ayah || '-'],
    ['No. Telp', p.phone || '-'], ['Alamat', p.address || '-'],
  ]
  const colW = CONTENT_W / 2
  for (let i = 0; i < identity.length; i += 2) {
    const cells = identity.slice(i, i + 2).map(([l, v]) => ({ l, v: wrap(v, colW - 30, 9) }))
    const h = Math.max(...cells.map((c) => c.v.length)) * 4.2 + 1.5
    ensure(h)
    cells.forEach((c, j) => {
      const x = M + j * colW
      doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(c.l, x, y)
      doc.setFontSize(9); doc.setTextColor(...TEXT); doc.text(c.v, x + 28, y, { lineHeightFactor: 1.3 })
    })
    y += h
  }
  y += 1
  doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y, PAGE_W - M, y)
  y += 7

  // ── Records ──
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
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y, PAGE_W - M, y)
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
        const labelW = 52
        doc.setFont('helvetica', 'normal')
        const ll = wrap(label, labelW - 3, 8.5)
        const vl = wrap(value, CONTENT_W - labelW, 9.5)
        const lh = 4.4
        const n = Math.max(ll.length, vl.length)
        ensure(n * lh + 1)
        doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(ll, M, y, { lineHeightFactor: 1.3 })
        doc.setFontSize(9.5); doc.setTextColor(...TEXT); doc.text(vl, M + labelW, y, { lineHeightFactor: 1.3 })
        y += n * lh + 1.2
      }
      y += 2
    }

    if (b.signature) {
      ensure(32)
      const x = PAGE_W - M - 60
      doc.setFontSize(9); doc.setTextColor(...TEXT)
      doc.text(`Pontianak, ${fmtLong(new Date())}`, x + 30, y + 2, { align: 'center' })
      doc.text(b.signature.role, x + 30, y + 7, { align: 'center' })
      doc.setDrawColor(...MUTED); doc.line(x + 5, y + 24, x + 55, y + 24)
      doc.text(b.signature.name ? `( ${b.signature.name} )` : '(                              )', x + 30, y + 28.5, { align: 'center' })
      y += 34
    }
    y += 4
  }

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text(`${p.name}${p.no_rm ? ` · ${p.no_rm}` : ''} · ${CLINIC}`, M, PAGE_H - 8)
    doc.text(`Halaman ${i} / ${total}`, PAGE_W - M, PAGE_H - 8, { align: 'right' })
  }

  doc.save(opts.filename)
}

export type { Block as GriyaPdfBlock }
