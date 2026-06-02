import type { PayrollRecord } from './types'
import { MONTHS, ROLE_LABELS, formatRupiah, toHumanIDR, calcNet } from './types'

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

  /** Render a table row: label | amount (Rp) | human-readable */
  function row(label: string, value: number, isDeduction = false): string {
    const human = toHumanIDR(value)
    const color = isDeduction ? '#dc2626' : '#111'
    const amountStr = isDeduction
      ? `<span style="color:#dc2626">(${formatRupiah(value)})</span>`
      : formatRupiah(value)
    return `
    <tr>
      <td style="color:${color}">${label}</td>
      <td class="amt" style="color:${color}">${amountStr}</td>
      <td class="hint">${isDeduction ? '' : human}</td>
    </tr>`
  }

  const earningsRows = [
    row('Gaji Pokok',           record.base_salary),
    row('Tunjangan Transport',  record.transport_allowance),
    row('Tunjangan Makan',      record.meal_allowance),
    ...(record.other_allowance > 0
      ? [row('Tunjangan Lainnya', record.other_allowance)]
      : []),
    ...(record.bonus_achievement > 0
      ? [row('Bonus Pencapaian', record.bonus_achievement)]
      : []),
    ...(record.deductions > 0
      ? [row('Potongan', record.deductions, true)]
      : []),
  ].join('')

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
      background: #f0f0f0;
      padding: 32px 16px;
    }

    .sheet {
      background: #fff;
      max-width: 700px;
      margin: 0 auto;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
    }

    /* ── Pink top bar ── */
    .top-bar {
      background: #FF0090;
      padding: 20px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand       { color: #fff; }
    .brand-name  { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .brand-sub   { font-size: 11px; opacity: .75; margin-top: 2px; }
    .slip-label  { text-align: right; color: #fff; }
    .slip-label h2 { font-size: 20px; font-weight: 700; }
    .slip-label p  { font-size: 12px; opacity: .75; margin-top: 3px; }

    /* ── Body ── */
    .body { padding: 28px 32px; }

    /* ── Employee info grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      background: #fafafa;
      border: 1px solid #eee;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .info-field label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
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
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    thead th:first-child  { text-align: left; }
    thead th.amt          { text-align: right; width: 170px; }
    thead th.hint         { text-align: right; width: 120px; font-weight: 400; opacity: .7; }

    tbody tr { border-bottom: 1px solid #f0f0f0; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { padding: 10px 16px; font-size: 13px; vertical-align: middle; }
    tbody td.amt  { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
    tbody td.hint {
      text-align: right;
      font-size: 11px;
      color: #aaa;
      font-style: italic;
      white-space: nowrap;
    }

    /* ── Total row ── */
    .row-total { border-top: 2px solid #FF0090 !important; background: #fff8fc !important; }
    .row-total td { font-size: 14px; font-weight: 700; padding: 14px 16px; }
    .row-total td.amt { color: #FF0090; font-size: 16px; }
    .row-total td.hint { font-size: 12px; color: #FF0090; font-style: normal; font-weight: 600; }

    /* ── Notes ── */
    .notes {
      margin-top: 14px;
      padding: 10px 14px;
      background: #fffbe6;
      border-left: 3px solid #f59e0b;
      border-radius: 0 6px 6px 0;
      font-size: 12px;
      color: #555;
    }

    /* ── Signatures ── */
    .sigs {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
    }
    .sig { text-align: center; width: 180px; }
    .sig .blank { height: 56px; }
    .sig .line  {
      border-top: 1px solid #333;
      padding-top: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #bbb;
    }

    /* ── Print button ── */
    .btn-wrap { text-align: center; margin-top: 28px; }
    .print-btn {
      background: #FF0090;
      color: #fff;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.2px;
    }
    .print-btn:hover { background: #d4007a; }

    @media print {
      body      { background: #fff; padding: 0; }
      .sheet    { box-shadow: none; border-radius: 0; }
      .btn-wrap { display: none !important; }
    }
  </style>
</head>
<body>
<div class="sheet">

  <div class="top-bar">
    <div class="brand">
      <div class="brand-name">GANG SEHAT</div>
      <div class="brand-sub">Fisioterapi &amp; Kesehatan</div>
    </div>
    <div class="slip-label">
      <h2>SLIP GAJI</h2>
      <p>Periode: ${period}</p>
    </div>
  </div>

  <div class="body">

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
          <th class="amt">Jumlah</th>
          <th class="hint">Terbilang</th>
        </tr>
      </thead>
      <tbody>
        ${earningsRows}
        <tr class="row-total">
          <td><strong>Total Gaji Bersih</strong></td>
          <td class="amt">${formatRupiah(net)}</td>
          <td class="hint">${toHumanIDR(net)}</td>
        </tr>
      </tbody>
    </table>

    ${record.notes ? `
    <div class="notes">
      <strong>Keterangan:</strong> ${record.notes}
    </div>` : ''}

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

  </div><!-- /.body -->
</div><!-- /.sheet -->

<div class="btn-wrap">
  <button class="print-btn" onclick="window.print()">
    Cetak / Simpan PDF
  </button>
</div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=820,height=960')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
