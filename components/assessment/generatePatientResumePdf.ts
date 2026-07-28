import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { TerapiAwalAssessment } from '@/types'
import type { PublicResumeData } from '@/app/actions/resumeLinks'
import { renderPatientResumeHtml } from '@/lib/patientResumeStyles'

// Staff-side "Cetak Resume Pasien" — patient-facing plain-language version of
// generateAssessmentPdf.ts, using the same window.open + document.write +
// window.print() pattern (see lib/pdfPrintStyles.ts). Shares its markup with
// the public app/resume/[token] page via lib/patientResumeStyles.ts.
export function generatePatientResumePdf(visit: VisitWithPatient, assessment: TerapiAwalAssessment) {
  const plan = [assessment.treatment_plan_today, assessment.short_term_goals, assessment.long_term_goals]
    .filter(Boolean)
    .join('') || visit.treatment

  const data: PublicResumeData = {
    patientName: visit.patient_name,
    visitDate: visit.visit_date,
    chiefComplaint: assessment.history_moi || visit.chief_complaint,
    diagnosis: assessment.diagnosis_primer || visit.diagnosis,
    plan,
  }

  const html = renderPatientResumeHtml(data)
  const win = window.open('', '_blank', 'width=820,height=960')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
