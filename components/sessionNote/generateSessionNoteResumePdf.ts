import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { SessionNote } from '@/types'
import type { PublicResumeData } from '@/app/actions/resumeLinks'
import { downloadPatientResumePdf } from '@/lib/downloadPatientResumePdf'

// Staff-side "Download Resume" for follow-up SOAP session notes — mirrors
// components/assessment/generatePatientResumePdf.ts (the TERAPI AWAL variant),
// sharing the same patient-facing markup via lib/patientResumeStyles.ts.
export async function generateSessionNoteResumePdf(visit: VisitWithPatient, note: SessionNote) {
  const plan = [note.next_plan, note.hep_given].filter(Boolean).join('') || visit.treatment

  const data: PublicResumeData = {
    patientName: visit.patient_name,
    visitDate: visit.visit_date,
    chiefComplaint: note.subjective_notes || visit.chief_complaint,
    diagnosis: note.clinical_impression || visit.diagnosis,
    plan,
  }

  await downloadPatientResumePdf(data, 'Resume')
}
