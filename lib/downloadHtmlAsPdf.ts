const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM = 10

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

    const sheet = doc.querySelector<HTMLElement>(selector)
    if (!sheet) throw new Error('Gagal merender dokumen')

    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff' })

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const contentWidthMm = A4_WIDTH_MM - MARGIN_MM * 2
    const contentHeightMm = A4_HEIGHT_MM - MARGIN_MM * 2
    const pageHeightPx = (contentHeightMm * canvas.width) / contentWidthMm

    let renderedPx = 0
    let page = 0
    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx)

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
