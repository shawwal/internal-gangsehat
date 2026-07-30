import type { PublicResumeData } from '@/app/actions/resumeLinks'
import { renderPatientResumeHtml } from '@/lib/patientResumeStyles'
import { downloadHtmlAsPdf } from '@/lib/downloadHtmlAsPdf'

// Patient-facing "Download Resume" — replaces the old window.open +
// document.write + window.print() flow, which silently no-oped when
// popups were blocked and required a second manual click plus the OS
// print dialog. Shared by the assessment (TERAPI AWAL) and session-note
// "Download Resume" buttons.
export async function downloadPatientResumePdf(data: PublicResumeData, filenamePrefix: string) {
  const html = renderPatientResumeHtml(data, false)
  const filename = `${filenamePrefix}-${data.patientName}-${data.visitDate}.pdf`
    .replace(/[^a-zA-Z0-9-_.]+/g, '_')
  await downloadHtmlAsPdf(html, filename)
}
