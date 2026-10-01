const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM = 10

// html2canvas measures text baselines and paints glyphs through the *host*
// document, not the iframe being captured. Two things there skew the output:
//   1. Tailwind's preflight `img { display: block }` breaks its baseline probe
//      (a 1x1 gif placed inline next to a text span), so every line of text is
//      painted a few px too low relative to borders, boxes and list bullets.
//   2. Web fonts declared only inside the iframe aren't known to the host, so
//      glyphs get painted in a fallback font at positions measured for the
//      real one (uneven word spacing).
// prepareHostDocument() neutralises both for the duration of one capture.
const BASELINE_PROBE_FIX =
  'img[src^="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP"] { display: inline !important; }'

async function prepareHostDocument(source: Document): Promise<() => void> {
  const style = document.createElement('style')
  style.textContent = BASELINE_PROBE_FIX
  document.head.appendChild(style)

  const faces: FontFace[] = []
  for (const sheet of Array.from(source.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      // Cross-realm rule objects fail `instanceof`, so match on the rule text.
      if (!rule.cssText.startsWith('@font-face')) continue
      const decl = (rule as CSSFontFaceRule).style
      const family = decl.getPropertyValue('font-family').trim().replace(/^['"]|['"]$/g, '')
      const src = decl.getPropertyValue('src')
      if (!family || !src) continue
      faces.push(new FontFace(family, src, {
        weight: decl.getPropertyValue('font-weight') || 'normal',
        style: decl.getPropertyValue('font-style') || 'normal',
      }))
    }
  }
  await Promise.all(faces.map((face) => face.load().then(() => { document.fonts.add(face) }).catch(() => {})))

  return () => {
    style.remove()
    for (const face of faces) document.fonts.delete(face)
  }
}

// Renders a self-contained HTML document off-screen in a hidden iframe and
// converts its `selector` element to a real, downloadable PDF file via
// html2canvas + jsPDF. Shared core for every "Download PDF" button (patient
// resume, clinical assessment/session-note exports) — see
// lib/downloadPatientResumePdf.ts for the resume-specific wrapper.
//
// Uses html2canvas + jsPDF directly rather than the html2pdf.js wrapper:
// html2pdf.js's internal cloning loses the iframe's own stylesheet when the
// captured element lives in a different document than the one that
// triggered it, rendering an unstyled page. Calling html2canvas directly
// against the iframe element does not have that problem.
export async function downloadHtmlAsPdf(html: string, filename: string, selector = '.sheet') {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '800px'
  iframe.style.height = '1px'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error('Gagal menyiapkan dokumen PDF')

    doc.open()
    doc.write(html)
    doc.close()

    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') { resolve(); return }
      iframe.onload = () => resolve()
    })

    // Images (e.g. the resume letterhead) must be decoded before capture or
    // html2canvas paints an empty box in their place.
    await Promise.all(Array.from(doc.images).map((img) => img.decode().catch(() => {})))

    // Same for web fonts declared by the document: a face only starts loading
    // once it is used, so force them all before capture or the text is painted
    // (and measured) in the fallback font.
    await Promise.all(Array.from(doc.fonts).map((font) => font.load().catch(() => {})))
    await doc.fonts.ready

    const sheet = doc.querySelector<HTMLElement>(selector)
    if (!sheet) throw new Error('Gagal merender dokumen')

    // Elements marked `data-pdf-break-before` always start a new page — the
    // PDF is sliced from one tall canvas, so CSS page-break rules don't apply.
    const sheetTop = sheet.getBoundingClientRect().top
    const forcedBreaksCss = Array.from(sheet.querySelectorAll<HTMLElement>('[data-pdf-break-before]'))
      .map((el) => el.getBoundingClientRect().top - sheetTop)
      .filter((top) => top > 0)
      .sort((x, y) => x - y)

    const restoreHost = await prepareHostDocument(doc)
    let canvas: HTMLCanvasElement
    try {
      canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff' })
    } finally {
      restoreHost()
    }

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2
    const contentHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2
    const pageHeightPx = (contentHeightMm * canvas.width) / contentWidthMm
    const canvasScale = canvas.width / sheet.getBoundingClientRect().width
    const forcedBreaksPx = forcedBreaksCss.map((top) => Math.floor(top * canvasScale))

    let renderedPx = 0
    let page = 0
    while (renderedPx < canvas.height) {
      const nextBreakPx = forcedBreaksPx.find((px) => px > renderedPx) ?? canvas.height
      const sliceHeightPx = Math.min(pageHeightPx, nextBreakPx - renderedPx, canvas.height - renderedPx)

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      sliceCanvas.getContext('2d')!.drawImage(
        canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx,
      )

      const sliceHeightMm = (sliceHeightPx * contentWidthMm) / canvas.width
      if (page > 0) pdf.addPage()
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', MARGIN_MM, MARGIN_MM, contentWidthMm, sliceHeightMm)

      renderedPx += sliceHeightPx
      page += 1
    }

    pdf.save(filename)
  } finally {
    document.body.removeChild(iframe)
  }
}
