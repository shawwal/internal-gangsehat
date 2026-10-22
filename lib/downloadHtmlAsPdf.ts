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

// Width the off-screen document is laid out (and captured) at.
const RENDER_WIDTH_PX = 800

// Blocks a page break must never cut through: text lines and small visual
// units, plus anything a template marks `data-pdf-keep-together` (whole
// sections/cards). Blocks taller than a page are exempt and split normally.
const KEEP_TOGETHER_SELECTOR =
  'p, li, h1, h2, h3, h4, h5, h6, img, tr, .phase, [data-pdf-keep-together]'

type SheetLayout = {
  width: number
  // CSS px offsets from the sheet top.
  forcedBreaks: number[]
  keepTogether: Array<[top: number, bottom: number]>
}

function measureSheet(sheet: HTMLElement): SheetLayout {
  const sheetRect = sheet.getBoundingClientRect()
  const offset = (el: Element) => {
    const rect = el.getBoundingClientRect()
    return [rect.top - sheetRect.top, rect.bottom - sheetRect.top] as [number, number]
  }
  return {
    width: sheetRect.width,
    // Elements marked `data-pdf-break-before` always start a new page — the
    // PDF is sliced from one tall canvas, so CSS page-break rules don't apply.
    forcedBreaks: Array.from(sheet.querySelectorAll('[data-pdf-break-before]'))
      .map((el) => offset(el)[0])
      .filter((top) => top > 0)
      .sort((x, y) => x - y),
    keepTogether: Array.from(sheet.querySelectorAll(KEEP_TOGETHER_SELECTOR))
      .map(offset)
      .filter(([top, bottom]) => bottom > top),
  }
}

// Moves a page cut at `limitPx` up to just above any keep-together block it
// would slice through. Falls back to the hard cut when no earlier gap exists,
// so every page still makes progress.
function safeBreak(
  startPx: number,
  limitPx: number,
  endPx: number,
  keepTogether: ReadonlyArray<readonly [number, number]>,
): number {
  if (limitPx >= endPx) return endPx
  let cut = limitPx
  for (;;) {
    const straddled = keepTogether.filter(([top, bottom]) => top < cut && bottom > cut)
    if (straddled.length === 0) break
    cut = Math.min(...straddled.map(([top]) => top))
  }
  return cut > startPx ? cut : limitPx
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
  iframe.style.width = `${RENDER_WIDTH_PX}px`
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

    // html2canvas re-lays the document out in its own scrollbar-less clone.
    // A 1px-tall iframe overflows, and on Windows (classic scrollbars) that
    // eats ~17px of width — the clone then wraps text differently, comes out
    // shorter, and page breaks measured here land in the wrong place (blank
    // or truncated pages). Kill the scrollbar and size the viewport to the
    // full document so both layouts are identical on every OS.
    doc.documentElement.style.overflow = 'hidden'
    const fullHeightPx = doc.documentElement.scrollHeight
    iframe.style.height = `${fullHeightPx}px`

    const sheet = doc.querySelector<HTMLElement>(selector)
    if (!sheet) throw new Error('Gagal merender dokumen')

    // Page-break geometry is read from the clone html2canvas actually paints
    // (onclone runs after its layout), so breaks always match the canvas.
    let layout: SheetLayout | null = null
    const restoreHost = await prepareHostDocument(doc)
    let canvas: HTMLCanvasElement
    try {
      canvas = await html2canvas(sheet, {
        scale: 2,
        backgroundColor: '#ffffff',
        windowWidth: RENDER_WIDTH_PX,
        windowHeight: fullHeightPx,
        onclone: (clonedDoc) => {
          const clonedSheet = clonedDoc.querySelector<HTMLElement>(selector)
          if (clonedSheet) layout = measureSheet(clonedSheet)
        },
      })
    } finally {
      restoreHost()
    }
    const measured: SheetLayout = layout ?? measureSheet(sheet)

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2
    const contentHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2
    const pageHeightPx = Math.floor((contentHeightMm * canvas.width) / contentWidthMm)
    const canvasScale = canvas.width / measured.width
    const toPx = (css: number) => Math.round(css * canvasScale)
    const forcedBreaksPx = measured.forcedBreaks.map(toPx)
    const keepTogetherPx = measured.keepTogether
      .map(([top, bottom]) => [toPx(top), toPx(bottom)] as const)
      // A block taller than a page can't be kept whole — let it split.
      .filter(([top, bottom]) => bottom - top < pageHeightPx)

    let renderedPx = 0
    let page = 0
    while (renderedPx < canvas.height) {
      const limitPx = Math.min(
        renderedPx + pageHeightPx,
        forcedBreaksPx.find((px) => px > renderedPx) ?? canvas.height,
        canvas.height,
      )
      const breakPx = safeBreak(renderedPx, limitPx, canvas.height, keepTogetherPx)
      const sliceHeightPx = breakPx - renderedPx

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      sliceCanvas.getContext('2d')!.drawImage(
        canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx,
      )

      const sliceHeightMm = (sliceHeightPx * contentWidthMm) / canvas.width
      if (page > 0) pdf.addPage()
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', MARGIN_MM, MARGIN_MM, contentWidthMm, sliceHeightMm)

      renderedPx = breakPx
      page += 1
    }

    pdf.save(filename)
  } finally {
    document.body.removeChild(iframe)
  }
}
