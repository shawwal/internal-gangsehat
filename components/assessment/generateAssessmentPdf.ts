import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { TerapiAwalAssessment } from '@/types'
import { openPdfWindow, pdfField } from '@/lib/pdfPrintStyles'
import { RED_FLAG_LABEL } from './types'

export function generateAssessmentPdf(visit: VisitWithPatient, assessment: TerapiAwalAssessment) {
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const visitDate = new Date(visit.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const redFlags = assessment.red_flags?.length
    ? assessment.red_flags.map((f) => RED_FLAG_LABEL[f]).join(', ')
    : 'Tidak ada'

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
      ${pdfField('Aggravating Factors', assessment.aggravating_factors)}
      ${pdfField('Easing Factors', assessment.easing_factors)}
      ${pdfField('Red Flags', `<p>${redFlags}</p>`)}
    </div>

    <div class="section">
      <div class="section-title">2. Physical Examination (Objective)</div>
      ${pdfField('Observation &amp; Gait / Posture', assessment.observation_gait_posture)}
      ${pdfField('Active &amp; Passive ROM', assessment.rom_active_passive)}
      ${pdfField('Muscle Strength (MMT)', assessment.muscle_strength_mmt)}
      ${pdfField('Special Orthopedic Tests', assessment.special_ortho_tests)}
      ${pdfField('Palpation', assessment.palpation)}
    </div>

    <div class="section">
      <div class="section-title">3. Neurological Screening</div>
      ${pdfField('Dermatomes (Sensory)', assessment.dermatomes_sensory)}
      ${pdfField('Myotomes (Motor)', assessment.myotomes_motor)}
      ${pdfField('Reflexes &amp; Neural Tension', assessment.reflexes_neural_tension)}
    </div>

    <div class="section">
      <div class="section-title">4. Objective Outcome Measures</div>
      ${pdfField('PROM Used / Baseline Score', `<p>${assessment.prom_used ?? '—'} ${assessment.prom_baseline_score != null ? `(${assessment.prom_baseline_score})` : ''}</p>`)}
      ${pdfField('Performance / Functional Metric Test', `<p>${assessment.functional_metric_test ?? '—'}</p>`)}
      ${pdfField('Baseline Result / Value', `<p>${assessment.functional_metric_baseline_value ?? '—'}</p>`)}
    </div>

    <div class="section">
      <div class="section-title">5. Clinical Reasoning (HOAC II)</div>
      ${pdfField('Physiotherapist-Identified Problems (NPIPs)', assessment.npips)}
      ${pdfField('Physiotherapy Diagnosis / Hypothesis', assessment.diagnosis_hypothesis)}
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
