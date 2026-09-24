import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { TerapiAwalAssessment } from '@/types'
import type { PublicResumeData } from '@/app/actions/resumeLinks'
import { downloadPatientResumePdf } from '@/lib/downloadPatientResumePdf'

// Staff-side "Download Resume" — patient-facing plain-language version of
// generateAssessmentPdf.ts, downloaded as a real PDF file via
// lib/downloadPatientResumePdf.ts. Shares its markup with the public
// app/resume/[token] page via lib/patientResumeStyles.ts.
export async function generatePatientResumePdf(visit: VisitWithPatient, assessment: TerapiAwalAssessment) {
  const chiefComplaint = [assessment.icf_body_functions_notes, assessment.icf_activity_notes]
    .filter(Boolean)
    .join('') || assessment.history_moi || visit.chief_complaint

  const plan = [assessment.short_term_goals, assessment.long_term_goals]
    .filter(Boolean)
    .join('') || visit.treatment

  const data: PublicResumeData = {
    patientName: visit.patient_name,
    visitDate: visit.visit_date,
    chiefComplaint,
    diagnosis: assessment.diagnosis_primer || visit.diagnosis,
    plan,
  }

  await downloadPatientResumePdf(data, 'Resume')
}
