import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { SessionNote } from '@/types'
import type { PublicResumeData } from '@/app/actions/resumeLinks'
import { renderPatientResumeHtml } from '@/lib/patientResumeStyles'

// Staff-side "Cetak Resume Pasien" for follow-up SOAP session notes — mirrors
// components/assessment/generatePatientResumePdf.ts (the TERAPI AWAL variant),
// sharing the same patient-facing markup via lib/patientResumeStyles.ts.
export function generateSessionNoteResumePdf(visit: VisitWithPatient, note: SessionNote) {
  const plan = [note.next_plan, note.hep_given].filter(Boolean).join('') || visit.treatment

  const data: PublicResumeData = {
    patientName: visit.patient_name,
    visitDate: visit.visit_date,
    chiefComplaint: note.subjective_notes || visit.chief_complaint,
    diagnosis: note.clinical_impression || visit.diagnosis,
    plan,
  }

  const html = renderPatientResumeHtml(data)
  const win = window.open('', '_blank', 'width=820,height=960')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
