import type { PayrollRecord } from './types'
import { MONTHS, ROLE_LABELS, formatRupiah, calcNet } from './types'

export function generatePayrollInvoice(record: PayrollRecord) {
  const staffName  = record.internal_profiles?.full_name ?? '—'
  const staffRole  = record.internal_profiles?.role
    ? (ROLE_LABELS[record.internal_profiles.role] ?? record.internal_profiles.role)
    : '—'
  const branchName = record.branches?.name ?? '—'
  const period     = `${MONTHS[record.period_month - 1]} ${record.period_year}`
  const net        = calcNet(record)
  const today      = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const earningsRows: { label: string; value: number }[] = [
    { label: 'Gaji Pokok',          value: record.base_salary },
    { label: 'Tunjangan Transport',  value: record.transport_allowance },
    { label: 'Tunjangan Makan',      value: record.meal_allowance },
    ...(record.other_allowance > 0
      ? [{ label: 'Tunjangan Lainnya', value: record.other_allowance }]
      : []),
    ...(record.bonus_achievement > 0
      ? [{ label: 'Bonus Pencapaian', value: record.bonus_achievement }]
      : []),
  ]

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Slip Gaji — ${staffName} — ${period}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: #111;
      background: #f5f5f5;
      padding: 32px 16px;
    }
    .sheet {
      background: #fff;
      max-width: 680px;
      margin: 0 auto;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 16px rgba(0,0,0,.08);
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 2px solid #FF0090;
      margin-bottom: 28px;
    }
    .brand       { font-size: 22px; font-weight: 800; color: #FF0090; letter-spacing: -0.5px; }
    .brand-sub   { font-size: 11px; color: #888; margin-top: 3px; }
    .slip-meta   { text-align: right; }
    .slip-meta h2 { font-size: 18px; font-weight: 700; }
    .slip-meta p  { font-size: 12px; color: #888; margin-top: 4px; }

    /* ── Employee info ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #fafafa;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .info-field label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #aaa;
      margin-bottom: 3px;
    }
    .info-field span { font-size: 13px; font-weight: 600; color: #111; }

    /* ── Salary table ── */
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #FF0090; }
    thead th {
      padding: 10px 16px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
    }
    thead th:last-child { text-align: right; }
    tbody tr { border-bottom: 1px solid #f0f0f0; }
    tbody tr:hover { background: #fef9fb; }
    tbody td { padding: 10px 16px; font-size: 13px; }
    tbody td:last-child { text-align: right; font-weight: 500; }
    .row-deduction td { color: #dc2626; }
    .row-total {
      border-top: 2px solid #FF0090 !important;
      background: #fff8fc !important;
    }
    .row-total td { font-weight: 700; font-size: 14px; padding: 12px 16px; }
    .row-total td:last-child { color: #FF0090; }

    /* ── Notes ── */
    .notes {
      margin-top: 12px;
      font-size: 12px;
      color: #666;
      font-style: italic;
    }

    /* ── Signatures ── */
    .sigs {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
    }
    .sig { text-align: center; width: 180px; }
    .sig .blank { height: 56px; }
    .sig .line {
      border-top: 1px solid #111;
      padding-top: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #bbb;
    }

    /* ── Print button (hidden on print) ── */
    .print-btn {
      display: block;
      margin: 28px auto 0;
      background: #FF0090;
      color: #fff;
      border: none;
      padding: 11px 28px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.2px;
    }
    .print-btn:hover { background: #e0007c; }

    @media print {
      body         { background: #fff; padding: 0; }
      .sheet       { box-shadow: none; border-radius: 0; padding: 24px; }
      .print-btn   { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">

    <div class="header">
      <div>
        <div class="brand">GANG SEHAT</div>
        <div class="brand-sub">Fisioterapi &amp; Kesehatan</div>
      </div>
      <div class="slip-meta">
        <h2>SLIP GAJI</h2>
        <p>Periode: ${period}</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-field">
        <label>Nama Karyawan</label>
        <span>${staffName}</span>
      </div>
      <div class="info-field">
        <label>Jabatan</label>
        <span>${staffRole}</span>
      </div>
      <div class="info-field">
        <label>Cabang</label>
        <span>${branchName}</span>
      </div>
      <div class="info-field">
        <label>Periode Gaji</label>
        <span>${period}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Komponen Gaji</th>
          <th>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${earningsRows.map(r => `
        <tr>
          <td>${r.label}</td>
          <td>${formatRupiah(r.value)}</td>
        </tr>`).join('')}
        ${record.deductions > 0 ? `
        <tr class="row-deduction">
          <td>Potongan</td>
          <td>(${formatRupiah(record.deductions)})</td>
        </tr>` : ''}
        <tr class="row-total">
          <td>Total Gaji Bersih</td>
          <td>${formatRupiah(net)}</td>
        </tr>
      </tbody>
    </table>

    ${record.notes ? `<p class="notes">Keterangan: ${record.notes}</p>` : ''}

    <div class="sigs">
      <div class="sig">
        <div class="blank"></div>
        <div class="line">Karyawan</div>
      </div>
      <div class="sig">
        <div class="blank"></div>
        <div class="line">Pimpinan</div>
      </div>
    </div>

    <div class="footer">
      Dokumen ini digenerate otomatis pada ${today} &middot; Sistem Internal Gang Sehat
    </div>

    <button class="print-btn" onclick="window.print()">
      Cetak / Simpan PDF
    </button>

  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=800,height=900')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
