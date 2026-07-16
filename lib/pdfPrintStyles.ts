// Shared inline CSS for browser print-to-PDF documents (clinical record exports).
// Follows the same window.open + document.write + window.print() pattern as
// components/salary/generateInvoice.ts. Kept as a plain string (not a CSS module)
// since window.document.write() needs a fully self-contained HTML document.
export const PDF_SHEET_STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: #111;
      background: #f0f0f0;
      padding: 32px 16px;
    }

    .sheet {
      background: #fff;
      max-width: 760px;
      margin: 0 auto;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
    }

    .top-bar {
      background: #FF0090;
      padding: 20px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand       { color: #fff; }
    .brand-name  { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .brand-sub   { font-size: 11px; opacity: .75; margin-top: 2px; }
    .doc-label   { text-align: right; color: #fff; }
    .doc-label h2 { font-size: 17px; font-weight: 700; }
    .doc-label p  { font-size: 12px; opacity: .75; margin-top: 3px; }

    .body { padding: 28px 32px; }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      background: #fafafa;
      border: 1px solid #eee;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .info-field label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #aaa;
      margin-bottom: 3px;
    }
    .info-field span { font-size: 13px; font-weight: 600; color: #111; }

    .section { margin-bottom: 20px; }
    .section-title {
      background: #FF0090;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .field { margin-bottom: 10px; }
    .field-label { font-size: 11px; font-weight: 700; color: #555; margin-bottom: 3px; }
    .field-value { font-size: 13px; color: #222; line-height: 1.5; }
    .field-value p { margin-bottom: 6px; }
    .field-value ul, .field-value ol { padding-left: 20px; margin-bottom: 6px; }
    .field-value.is-empty::before { content: '—'; color: #bbb; }

    .context-box {
      background: #fff8fc;
      border: 1px solid #ffd1e8;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      font-size: 12px;
      color: #555;
    }
    .context-box strong { color: #FF0090; }

    .sigs {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
    }
    .sig { text-align: center; width: 180px; }
    .sig .blank { height: 56px; }
    .sig .line  {
      border-top: 1px solid #333;
      padding-top: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #bbb;
    }

    .btn-wrap { text-align: center; margin-top: 28px; }
    .print-btn {
      background: #FF0090;
      color: #fff;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.2px;
    }
    .print-btn:hover { background: #d4007a; }

    @media print {
      body      { background: #fff; padding: 0; }
      .sheet    { box-shadow: none; border-radius: 0; }
      .btn-wrap { display: none !important; }
    }
`

export function pdfField(label: string, html: string | null): string {
  const value = html && html.trim() ? html : ''
  return `
    <div class="field">
      <div class="field-label">${label}</div>
      <div class="field-value ${value ? '' : 'is-empty'}">${value}</div>
    </div>`
}

export function openPdfWindow(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${PDF_SHEET_STYLES}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=960')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
