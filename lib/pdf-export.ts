// Generic "print to PDF" report generator, following the same
// styled-HTML-in-new-window pattern as components/salary/generateInvoice.ts.
// Opens a new window with a printable table + a "Cetak / Simpan PDF" button
// that calls window.print() — no PDF library dependency needed.

export interface PrintableColumn<T> {
  header: string
  align?: 'left' | 'right' | 'center'
  value: (row: T) => string
}

export interface PrintableReportOptions<T> {
  title: string
  subtitle?: string
  meta?: { label: string; value: string }[]
  columns: PrintableColumn<T>[]
  rows: T[]
  totalsRow?: string[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function openPrintableReport<T>(opts: PrintableReportOptions<T>): void {
  const { title, subtitle, meta = [], columns, rows, totalsRow } = opts
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  const headerCells = columns.map((c) => `<th style="text-align:${c.align ?? 'left'}">${esc(c.header)}</th>`).join('')
  const bodyRows = rows.map((r) => {
    const cells = columns.map((c) => `<td style="text-align:${c.align ?? 'left'}">${esc(c.value(r))}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')
  const totalsCells = totalsRow
    ? `<tr class="row-total">${totalsRow.map((v, i) => `<td style="text-align:${columns[i]?.align ?? 'left'}">${esc(v)}</td>`).join('')}</tr>`
    : ''

  const metaRows = meta.map((m) => `
    <div class="info-field">
      <label>${esc(m.label)}</label>
      <span>${esc(m.value)}</span>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f2f2f2; padding: 32px; color: #111; }
  .sheet { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
  .top-bar { display: flex; justify-content: space-between; align-items: flex-start; padding: 28px 32px; border-bottom: 3px solid #FF0090; }
  .brand-name { font-size: 20px; font-weight: 800; color: #FF0090; letter-spacing: 0.5px; }
  .brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
  .slip-label { text-align: right; }
  .slip-label h2 { font-size: 16px; font-weight: 700; }
  .slip-label p { font-size: 11px; color: #888; margin-top: 2px; }
  .body { padding: 28px 32px; }
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
  .info-field label { display: block; font-size: 10px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; margin-bottom: 2px; }
  .info-field span { font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #fafafa; padding: 10px 12px; font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.4px; border-bottom: 1px solid #eee; }
  td { padding: 9px 12px; border-bottom: 1px solid #f2f2f2; }
  .row-total td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; }
  .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 24px; }
  .btn-wrap { text-align: center; margin-top: 28px; }
  .print-btn { background: #FF0090; color: #fff; border: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.2px; }
  .print-btn:hover { background: #d4007a; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; }
    .btn-wrap { display: none !important; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="top-bar">
    <div>
      <div class="brand-name">GANG SEHAT</div>
      <div class="brand-sub">Fisioterapi &amp; Kesehatan</div>
    </div>
    <div class="slip-label">
      <h2>${esc(title)}</h2>
      ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
    </div>
  </div>
  <div class="body">
    ${meta.length ? `<div class="info-grid">${metaRows}</div>` : ''}
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}${totalsCells}</tbody>
    </table>
    <div class="footer">Dokumen ini digenerate otomatis pada ${today} &middot; Sistem Internal Gang Sehat</div>
  </div>
</div>
<div class="btn-wrap">
  <button class="print-btn" onclick="window.print()">Cetak / Simpan PDF</button>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=1000')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
