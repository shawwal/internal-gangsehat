// Patient-facing "Recovery Roadmap" resume — plain language, no clinical jargon.
// Rendered both as a print window (staff side, see components/assessment/
// generatePatientResumePdf.ts) and as the public /resume/[token] page, so the
// markup/styles live here once and get reused by both entry points.
import type { PublicResumeData } from '@/app/actions/resumeLinks'

export const PATIENT_RESUME_STYLES = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      color: #2c3e50;
      line-height: 1.6;
      background: #e9ecef;
      padding: 24px 16px;
    }

    .sheet {
      background: #fff;
      max-width: 800px;
      margin: 0 auto;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      padding: 20mm;
    }

    .resume-header { text-align: center; border-bottom: 2px solid #FF0090; padding-bottom: 20px; margin-bottom: 30px; }
    .resume-header h1 { font-family: Arial, sans-serif; color: #1a4a76; margin: 0; font-size: 24pt; text-transform: uppercase; letter-spacing: 2px; }
    .resume-header h2 { font-family: Arial, sans-serif; color: #7f8c8d; margin: 6px 0 0 0; font-size: 12pt; font-weight: 300; }

    .resume-meta {
      display: flex; justify-content: space-between; margin-bottom: 30px;
      font-family: Arial, sans-serif; font-size: 11pt;
      border: 1px solid #ecf0f1; padding: 15px; border-radius: 8px; background: #fbfcfc;
    }

    .resume-section { margin-bottom: 30px; }
    .resume-section h3 {
      font-family: Arial, sans-serif; color: #FF0090;
      border-left: 4px solid #FF0090; padding-left: 10px;
      font-size: 14pt; margin-bottom: 12px;
    }
    .resume-content { font-size: 11pt; }
    .resume-box { background: #fdfefe; padding: 12px 15px; border-left: 3px solid #bdc3c7; border-radius: 0 6px 6px 0; }
    .resume-box.plan { background: #fff0f7; border-left-color: #FF0090; border-radius: 8px; }
    .resume-box p { margin-bottom: 6px; }
    .resume-box ul, .resume-box ol { padding-left: 20px; margin-bottom: 6px; }
    .empty { color: #adb5bd; font-style: italic; }

    .education-box { background: #f4f6f7; border: 1px solid #bdc3c7; border-radius: 10px; padding: 20px; margin-top: 30px; page-break-inside: avoid; }
    .education-box h4 { font-family: Arial, sans-serif; color: #FF0090; margin: 0 0 15px 0; font-size: 13pt; text-align: center; }
    .education-box p { text-align: center; font-family: Arial, sans-serif; font-size: 10pt; color: #2c3e50; margin-bottom: 18px; }
    .healing-phases { display: flex; gap: 14px; }
    .phase { flex: 1; background: #fff; padding: 14px; border-radius: 6px; border-top: 4px solid #FF0090; box-shadow: 0 2px 5px rgba(0,0,0,.05); text-align: center; }
    .phase:nth-child(2) { border-top-color: #FFB35C; }
    .phase:nth-child(3) { border-top-color: #34C759; }
    .phase-title { font-weight: bold; color: #34495e; font-family: Arial, sans-serif; display: block; margin-bottom: 8px; font-size: 10pt; }
    .phase-desc { font-size: 9pt; color: #7f8c8d; font-family: Arial, sans-serif; }

    .signature-block { margin-top: 40px; text-align: right; font-family: Arial, sans-serif; }
    .signature-line { border-bottom: 1px solid #2c3e50; width: 200px; display: inline-block; margin-bottom: 5px; }

    .btn-wrap { text-align: center; margin-top: 24px; }
    .print-btn {
      background: #FF0090; color: #fff; border: none;
      padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 700;
      cursor: pointer; letter-spacing: .2px; font-family: Arial, sans-serif;
    }
    .print-btn:hover { background: #d4007a; }

    .not-found { max-width: 480px; margin: 80px auto; text-align: center; font-family: Arial, sans-serif; color: #6c757d; }

    @media print {
      body      { background: #fff; padding: 0; }
      .sheet    { box-shadow: none; border-radius: 0; padding: 0; }
      .btn-wrap { display: none !important; }
      @page { size: A4; margin: 15mm; }
    }
`

function box(html: string | null, extraClass = ''): string {
  if (!html || !html.trim()) return `<div class="resume-box ${extraClass}"><p class="empty">Belum ada catatan.</p></div>`
  return `<div class="resume-box ${extraClass}">${html}</div>`
}

export function renderPatientResumeBody(data: PublicResumeData, includePrintButton: boolean): string {
  const visitDate = new Date(data.visitDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })

  return `
<div class="sheet">
  <div class="resume-header">
    <h1>Fisioterapi Gang Sehat</h1>
    <h2>Peta Jalan Pemulihan Anda</h2>
  </div>

  <div class="resume-meta">
    <div><strong>Nama Pasien:</strong> ${data.patientName}</div>
    <div><strong>Tanggal Konsultasi:</strong> ${visitDate}</div>
  </div>

  <div class="resume-section">
    <h3>1. Apa yang Terjadi Pada Tubuh Anda?</h3>
    <p class="resume-content" style="margin-bottom: 10px;">Berdasarkan pemeriksaan hari ini, keluhan utama Anda adalah:</p>
    ${box(data.chiefComplaint)}
    <p class="resume-content" style="margin: 15px 0 10px;">Kesimpulan diagnosis gangguan gerak dan fungsi tubuh Anda:</p>
    ${box(data.diagnosis)}
  </div>

  <div class="resume-section">
    <h3>2. Rencana Tindakan Lanjutan</h3>
    <p class="resume-content" style="margin-bottom: 10px;">Berikut target dan tindakan yang kami rancang khusus untuk Anda:</p>
    ${box(data.plan, 'plan')}
  </div>

  <div class="education-box">
    <h4>Kenapa Anda Membutuhkan Program Terapi Lanjutan?</h4>
    <p>
      Seringkali, saat rasa nyeri mereda setelah 1-2 sesi terapi perdana, pasien merasa sudah sembuh total.
      Padahal, hilangnya nyeri baru tahap awal. Jaringan tubuh membutuhkan waktu adaptasi agar masalah tidak
      kambuh di kemudian hari.
    </p>
    <div class="healing-phases">
      <div class="phase">
        <span class="phase-title">Fase 1: Manajemen Nyeri</span>
        <span class="phase-desc">Meredakan peradangan dan sinyal bahaya pada tubuh Anda.</span>
      </div>
      <div class="phase">
        <span class="phase-title">Fase 2: Perbaikan Jaringan</span>
        <span class="phase-desc">Mengembalikan kelenturan sendi dan memulihkan kualitas jaringan.</span>
      </div>
      <div class="phase">
        <span class="phase-title">Fase 3: Penguatan</span>
        <span class="phase-desc">Membangun kembali ketahanan otot agar keluhan Anda tidak kambuh lagi.</span>
      </div>
    </div>
  </div>

  <div class="signature-block">
    <p>Salam Sehat,</p>
    <div class="signature-line"></div>
    <p style="margin-top: 0; font-weight: bold; color: #1a4a76;">Fisioterapis Pemeriksa</p>
    <p style="font-size: 9pt; color: #7f8c8d; margin-top: -6px;">Fisioterapi Gang Sehat</p>
  </div>

  ${includePrintButton ? `
  <div class="btn-wrap">
    <button type="button" class="print-btn" onclick="window.print()">Unduh PDF</button>
  </div>` : ''}
</div>`
}

export function renderPatientResumeHtml(data: PublicResumeData): string {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resume Pasien — ${data.patientName}</title>
  <style>${PATIENT_RESUME_STYLES}</style>
</head>
<body>
${renderPatientResumeBody(data, true)}
</body>
</html>`
  return html
}
