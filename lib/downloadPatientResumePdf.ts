import type { PublicResumeData } from '@/app/actions/resumeLinks'
import { renderPatientResumeHtml } from '@/lib/patientResumeStyles'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const MARGIN_MM = 10

// Renders the patient resume markup off-screen in a hidden iframe and
// converts it to a real, downloadable PDF file — replacing the old
// window.open + document.write + window.print() flow, which silently
// no-oped when popups were blocked and required a second manual click plus
// the OS print dialog. Shared by the assessment (TERAPI AWAL) and
// session-note "Download Resume" buttons.
//
// Uses html2canvas + jsPDF directly rather than the html2pdf.js wrapper:
// html2pdf.js's internal cloning loses the iframe's own stylesheet when the
// captured element lives in a different document than the one that
// triggered it, rendering an unstyled page. Calling html2canvas directly
// against the iframe element does not have that problem.
export async function downloadPatientResumePdf(data: PublicResumeData, filenamePrefix: string) {
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
    doc.write(renderPatientResumeHtml(data, false))
    doc.close()

    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') { resolve(); return }
      iframe.onload = () => resolve()
    })

    const sheet = doc.querySelector<HTMLElement>('.sheet')
    if (!sheet) throw new Error('Gagal merender resume')

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

    const filename = `${filenamePrefix}-${data.patientName}-${data.visitDate}.pdf`
      .replace(/[^a-zA-Z0-9-_.]+/g, '_')
    pdf.save(filename)
  } finally {
    document.body.removeChild(iframe)
  }
}
