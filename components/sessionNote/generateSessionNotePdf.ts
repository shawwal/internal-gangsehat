import type { VisitWithPatient } from '@/app/actions/jadwal'
import type { SessionNote, TerapiAwalAssessment } from '@/types'
import { openPdfWindow, pdfField } from '@/lib/pdfPrintStyles'
import { SYMPTOM_TREND_LABEL, TREATMENTS_PERFORMED_LABEL } from './types'

export function generateSessionNotePdf(
  visit: VisitWithPatient,
  note: SessionNote,
  priorAssessment?: TerapiAwalAssessment | null,
) {
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const visitDate = new Date(visit.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const treatments = note.treatments_performed?.length
    ? note.treatments_performed.map((t) => TREATMENTS_PERFORMED_LABEL[t]).join(', ')
    : 'Tidak ada'

  const contextBox = priorAssessment ? `
    <div class="context-box">
      <strong>Konteks Asesmen Awal:</strong> ${priorAssessment.diagnosis_hypothesis ?? '—'}
    </div>` : ''

  const body = `
<div class="sheet">
  <div class="top-bar">
    <div class="brand">
      <div class="brand-name">GANG SEHAT</div>
      <div class="brand-sub">Fisioterapi &amp; Kesehatan</div>
    </div>
    <div class="doc-label">
      <h2>CATATAN PERAWATAN (SOAP)</h2>
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

    ${contextBox}

    <div class="section">
      <div class="section-title">1. Subjective</div>
      ${pdfField('Skala Nyeri', `<p>${note.pain_scale ?? '—'}/10</p>`)}
      ${pdfField('Sejak Sesi Terakhir', `<p>${note.symptom_trend ? SYMPTOM_TREND_LABEL[note.symptom_trend] : '—'}</p>`)}
      ${pdfField('Catatan', note.subjective_notes)}
    </div>

    <div class="section">
      <div class="section-title">2. Objective</div>
      ${pdfField('ROM, Strength, Palpation, Special Tests', note.objective_findings)}
    </div>

    <div class="section">
      <div class="section-title">3. Assessment</div>
      ${pdfField('Clinical Impression / Physio Diagnosis', note.clinical_impression)}
    </div>

    <div class="section">
      <div class="section-title">4. Plan &amp; Intervensi Hari Ini</div>
      ${pdfField('Tindakan yang Dilakukan', `<p>${treatments}</p>`)}
      ${pdfField('Catatan Tindakan', note.treatment_notes)}
      ${pdfField('Home Exercise Program (HEP)', note.hep_given)}
      ${pdfField('Plan Sesi Berikutnya', note.next_plan)}
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

  openPdfWindow(`Catatan Perawatan — ${visit.patient_name} — ${visitDate}`, body)
}
