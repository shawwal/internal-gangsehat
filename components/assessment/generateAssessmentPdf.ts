import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { TerapiAwalAssessment } from '@/types'
import { openPdfWindow, pdfField } from '@/lib/pdfPrintStyles'
import {
  RED_FLAG_LABEL, PAIN_ONSET_LABEL, PAIN_CHARACTER_LABEL, PAIN_RADIATION_LABEL,
  PAIN_ASSOCIATED_SYMPTOM_LABEL, PAIN_TIME_COURSE_LABEL,
  AROM_LABEL, PROM_ENDFEEL_LABEL, ISOMETRIC_LABEL,
  DERMATOME_STATUS_LABEL, MYOTOME_STATUS_LABEL, REFLEX_STATUS_LABEL,
  OBSERVATION_FINDING_LABEL, ICF_SEVERITY_LABEL,
} from './types'

export function generateAssessmentPdf(visit: VisitWithPatient, assessment: TerapiAwalAssessment) {
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const visitDate = new Date(visit.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const redFlags = assessment.red_flags?.length
    ? assessment.red_flags.map((f) => RED_FLAG_LABEL[f]).join(', ')
    : 'Tidak ada'

  const socratesParts = [
    assessment.pain_site && `Site: ${assessment.pain_site}`,
    assessment.pain_onset && `Onset: ${PAIN_ONSET_LABEL[assessment.pain_onset]}`,
    assessment.pain_character && `Character: ${PAIN_CHARACTER_LABEL[assessment.pain_character]}`,
    assessment.pain_radiation && `Radiation: ${PAIN_RADIATION_LABEL[assessment.pain_radiation]}`,
    assessment.pain_time_course && `Time Course: ${PAIN_TIME_COURSE_LABEL[assessment.pain_time_course]}`,
  ].filter(Boolean)
  const associatedSymptoms = assessment.pain_associated_symptoms?.length
    ? assessment.pain_associated_symptoms.map((s) => PAIN_ASSOCIATED_SYMPTOM_LABEL[s]).join(', ')
    : null
  const socratesHtml = socratesParts.length || associatedSymptoms || assessment.pain_severity_vas != null
    ? `<p>${[...socratesParts, associatedSymptoms && `Associations: ${associatedSymptoms}`].filter(Boolean).join(' &middot; ')}</p>
       <p>Severity (VAS/NPRS): ${assessment.pain_severity_vas ?? '—'}/10</p>`
    : null

  const jointRows = assessment.joint_exam_rows ?? []
  const jointTableHtml = jointRows.length
    ? `<table class="exam-table">
        <thead><tr><th>Sendi/Gerakan</th><th>AROM</th><th>PROM/End-Feel</th><th>Tahanan Isometrik</th></tr></thead>
        <tbody>${jointRows.map((r) => `<tr>
          <td>${r.joint || '—'}</td>
          <td>${r.arom ? AROM_LABEL[r.arom] : '—'}</td>
          <td>${r.prom ? PROM_ENDFEEL_LABEL[r.prom] : '—'}</td>
          <td>${r.isometric ? ISOMETRIC_LABEL[r.isometric] : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>`
    : null

  const dermatomesHtml = assessment.dermatomes_status
    ? `<p>${DERMATOME_STATUS_LABEL[assessment.dermatomes_status]}${assessment.dermatomes_notes ? ` — ${assessment.dermatomes_notes}` : ''}</p>`
    : null
  const myotomesHtml = assessment.myotomes_status
    ? `<p>${MYOTOME_STATUS_LABEL[assessment.myotomes_status]}${assessment.myotomes_notes ? ` — ${assessment.myotomes_notes}` : ''}</p>`
    : null
  const reflexesHtml = assessment.reflexes_status
    ? `<p>${REFLEX_STATUS_LABEL[assessment.reflexes_status]}${assessment.reflexes_notes ? ` — ${assessment.reflexes_notes}` : ''}</p>`
    : null

  const observationFindingsHtml = assessment.observation_findings?.length
    ? `<p>${assessment.observation_findings.map((f) => OBSERVATION_FINDING_LABEL[f]).join(', ')}</p>`
    : null

  function icfDomainHtml(notes: string | null, severity: string | null) {
    if (!notes && !severity) return null
    return `<p>${severity ? `[${ICF_SEVERITY_LABEL[severity as keyof typeof ICF_SEVERITY_LABEL]}] ` : ''}${notes ?? ''}</p>`
  }

  const body = `
<div class="sheet">
  <div class="top-bar">
    <div class="brand">
      <div class="brand-name">GANG SEHAT</div>
      <div class="brand-sub">Fisioterapi &amp; Kesehatan</div>
    </div>
    <div class="doc-label">
      <h2>GUIDED MSK &amp; SPORTS ASSESSMENT</h2>
      <p>Tanggal: ${visitDate}</p>
    </div>
  </div>

  <div class="body">
    <div class="info-grid">
      <div class="info-field"><label>Nama Pasien</label><span>${visit.patient_name}</span></div>
      <div class="info-field"><label>Regio</label><span>${visit.regio ?? '—'}</span></div>
      <div class="info-field"><label>Shift</label><span>${visit.shift ?? '—'}</span></div>
      <div class="info-field"><label>Kehadiran</label><span>${visit.kehadiran ?? '—'}</span></div>
    </div>

    <div class="section">
      <div class="section-title">1. Interview (Subjective &amp; PIPs)</div>
      ${pdfField('History &amp; Mechanism of Injury', assessment.history_moi)}
      ${pdfField('Riwayat Nyeri (SOCRATES)', socratesHtml)}
      ${pdfField('Aggravating Factors', assessment.aggravating_factors)}
      ${pdfField('Easing Factors', assessment.easing_factors)}
      ${pdfField('Riwayat Cedera/Pengobatan', assessment.riwayat_cedera_pengobatan)}
      ${pdfField('Red Flags', `<p>${redFlags}</p>`)}
    </div>

    <div class="section">
      <div class="section-title">2. Physical Examination (Objective)</div>
      ${pdfField('Observation &amp; Gait / Posture', [observationFindingsHtml, assessment.observation_gait_posture].filter(Boolean).join(''))}
      ${pdfField('Active &amp; Passive ROM', jointTableHtml ?? assessment.rom_active_passive)}
      ${pdfField('Special Orthopedic Tests', assessment.special_ortho_tests)}
      ${pdfField('Palpation', assessment.palpation)}
    </div>

    <div class="section">
      <div class="section-title">3. Neurological Screening</div>
      ${pdfField('Dermatomes (Sensory)', dermatomesHtml ?? assessment.dermatomes_sensory)}
      ${pdfField('Myotomes (Motor)', myotomesHtml ?? assessment.myotomes_motor)}
      ${pdfField('Reflexes &amp; Neural Tension', reflexesHtml ?? assessment.reflexes_neural_tension)}
    </div>

    <div class="section">
      <div class="section-title">4. Objective Outcome Measures</div>
      ${pdfField('Alat Ukur / Skor', `<p>${assessment.prom_used ?? '—'} ${assessment.prom_baseline_score != null ? `(${assessment.prom_baseline_score})` : ''}</p>`)}
      ${pdfField('Catatan', assessment.outcome_measure_notes)}
    </div>

    <div class="section">
      <div class="section-title">5. Clinical Reasoning — ICF Functional Framework</div>
      ${pdfField('Diagnosa Primer', assessment.diagnosis_primer ? `<p>${assessment.diagnosis_primer}</p>` : null)}
      ${pdfField('Diagnosa Sekunder', assessment.diagnosis_sekunder ? `<p>${assessment.diagnosis_sekunder}</p>` : null)}
      ${pdfField('Body Functions &amp; Structures', icfDomainHtml(assessment.icf_body_functions_notes, assessment.icf_body_functions_severity))}
      ${pdfField('Activity Limitations', icfDomainHtml(assessment.icf_activity_notes, assessment.icf_activity_severity))}
      ${pdfField('Participation Restrictions', icfDomainHtml(assessment.icf_participation_notes, assessment.icf_participation_severity))}
      ${pdfField('Contextual Factors', icfDomainHtml(assessment.icf_contextual_notes, assessment.icf_contextual_severity))}
    </div>

    <div class="section">
      <div class="section-title">6. Plan of Care &amp; Goals</div>
      ${pdfField('Short-Term Goals', assessment.short_term_goals)}
      ${pdfField('Long-Term Goals', assessment.long_term_goals)}
      ${pdfField('Treatment Plan for Today', assessment.treatment_plan_today)}
    </div>

    <div class="sigs">
      <div class="sig"><div class="blank"></div><div class="line">Terapis</div></div>
      <div class="sig"><div class="blank"></div><div class="line">Pasien</div></div>
    </div>

    <div class="footer">
      Dokumen ini digenerate otomatis pada ${today} &middot; Sistem Internal Gang Sehat
    </div>
  </div>
</div>

<div class="btn-wrap">
  <button class="print-btn" onclick="window.print()">Cetak / Simpan PDF</button>
</div>`

  openPdfWindow(`Asesmen Terapi Awal — ${visit.patient_name} — ${visitDate}`, body)
}
