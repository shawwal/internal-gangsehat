// Payroll calculation engine (replaces the ABS/INS/GAJI formulas).
// Pure and deterministic: every rate comes from the inputs, so a locked period
// recalculates to the same figures from its snapshot.
//
// Evaluation order (spec §2.1 Module 4):
//   Gross      = base salary + fixed allowances + Σ(task qty × rate)
//   Deductions = attendance penalties + ad-hoc fines
//   Net        = Gross − Deductions, floored to the rounding unit

import type {
  Adjustment, AttendanceSummary, Compensation, DeductionRule, PayrollLine, PayrollResult,
} from './types'
import { ADJUSTMENT_CATEGORY_LABEL } from './types'

export function floorTo(value: number, unit: number): number {
  if (unit <= 1) return Math.floor(value)
  // Small epsilon guards against binary noise (e.g. 0.29 × 100000).
  return Math.floor(value / unit + 1e-9) * unit
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

export interface OperasionalResult {
  amount: number   // may be negative for the daily_deduction mode
  ratio: number | null
  detail: string
}

/**
 * ABS!AR.
 * prorata: r = (hadir + sakit + cuti + alfa) / workdays; r ≤ threshold → 0, else floor(r × OPS).
 *   (r is capped at 1 so working on an off day can't exceed the full allowance.)
 * daily_deduction (masseur row): (hadir + cuti) × rate − workdays × rate.
 */
export function computeOperasional(c: Compensation, a: AttendanceSummary, unit: number): OperasionalResult {
  if (c.operasional_mode === 'none') return { amount: 0, ratio: null, detail: 'Tidak ada tunjangan operasional' }
  if (c.operasional_mode === 'daily_deduction') {
    const amount = (a.hadir + a.cuti) * c.operasional_daily_rate - a.workdays * c.operasional_daily_rate
    return {
      amount,
      ratio: null,
      detail: `(${a.hadir} hadir + ${a.cuti} cuti − ${a.workdays} hari kerja) × ${fmt(c.operasional_daily_rate)}`,
    }
  }
  if (a.workdays <= 0 || c.operasional <= 0) return { amount: 0, ratio: null, detail: 'Tidak ada tunjangan operasional' }
  const counted = a.hadir + a.sakit + a.cuti + a.alfa
  const ratio = Math.min(1, counted / a.workdays)
  if (ratio <= c.operasional_threshold) {
    return {
      amount: 0,
      ratio,
      detail: `${counted}/${a.workdays} hari = ${(ratio * 100).toFixed(1)}% ≤ batas ${(c.operasional_threshold * 100).toFixed(0)}% → 0`,
    }
  }
  return {
    amount: floorTo(ratio * c.operasional, unit),
    ratio,
    detail: `${counted}/${a.workdays} hari × ${fmt(c.operasional)}`,
  }
}

export interface IncentiveResult {
  qty: number
  base: number
  bonus: number
  detail: string
}

/** INS!P — floor(min(1, qty/target) × INSENTIF) + bonus tiers (qty ≥ min). */
export function computeIncentive(c: Compensation, qtyByCode: Record<string, number>, unit: number): IncentiveResult {
  const qty = c.incentive_activity_codes.reduce((sum, code) => sum + (qtyByCode[code] ?? 0), 0)
  let base = 0
  let detail = ''
  if (c.insentif_base > 0) {
    if (c.incentive_target > 0) {
      const ratio = Math.min(1, qty / c.incentive_target)
      base = floorTo(ratio * c.insentif_base, unit)
      detail = `${qty}/${c.incentive_target} target × ${fmt(c.insentif_base)}`
    } else {
      base = c.insentif_base
      detail = 'Insentif tetap (tanpa target)'
    }
  }
  let bonus = 0
  for (const tier of c.bonus_tiers) {
    if (qty >= tier.min_qty) {
      bonus += tier.amount
      detail += `${detail ? ' + ' : ''}${tier.label ?? 'Bonus'} (≥ ${tier.min_qty}) ${fmt(tier.amount)}`
    }
  }
  return { qty, base, bonus, detail: detail || 'Tidak ada insentif' }
}

/** INS!Z — Σ qty × rate for every activity that has a rate. */
export function computeVisitBonus(c: Compensation, qtyByCode: Record<string, number>): { amount: number; detail: string } {
  let amount = 0
  const parts: string[] = []
  for (const [code, rate] of Object.entries(c.activity_rates)) {
    const qty = qtyByCode[code] ?? 0
    if (!rate || !qty) continue
    amount += qty * rate
    parts.push(`${qty} × ${fmt(rate)} (${code})`)
  }
  return { amount, detail: parts.join(' + ') || 'Tidak ada kunjungan berbonus' }
}

function basisQty(rule: DeductionRule, a: AttendanceSummary): number {
  switch (rule.basis) {
    case 'late_minutes': return a.lateMinutes
    case 'late_days':    return a.lateDays
    case 'alfa_days':    return a.alfa
    case 'izin_days':    return a.izin
    case 'sakit_days':   return a.sakit
  }
}

const BASIS_UNIT: Record<DeductionRule['basis'], string> = {
  late_minutes: 'menit terlambat',
  late_days: 'hari terlambat',
  alfa_days: 'hari alfa',
  izin_days: 'hari izin',
  sakit_days: 'hari sakit',
}

/** ABS!AS:AT generalised — fixed per unit or % of GAJI POKOK per unit. */
export function computeDeductionLines(rules: DeductionRule[], c: Compensation, a: AttendanceSummary): PayrollLine[] {
  return rules
    .filter((r) => r.is_active)
    .sort((x, y) => x.sort_order - y.sort_order)
    .map((r) => {
      const qty = basisQty(r, a)
      const perUnit = r.calc_type === 'fixed' ? r.amount : (c.gaji_pokok * r.amount) / 100
      return {
        code: `RULE_${r.code}`,
        label: r.label,
        kind: 'deduction' as const,
        amount: Math.round(qty * perUnit),
        detail: r.calc_type === 'fixed'
          ? `${qty} ${BASIS_UNIT[r.basis]} × ${fmt(r.amount)}`
          : `${qty} ${BASIS_UNIT[r.basis]} × ${r.amount}% gaji pokok`,
      }
    })
}

export interface ComputePayrollInput {
  compensation: Compensation
  attendance: AttendanceSummary
  activity: Record<string, number>
  deductionRules: DeductionRule[]
  adjustments: Adjustment[]
  roundingUnit: number
}

/** One employee's GAJI row + SLIP lines. */
export function computePayroll(input: ComputePayrollInput): PayrollResult {
  const { compensation: c, attendance: a, activity, deductionRules, adjustments, roundingUnit: unit } = input
  const lines: PayrollLine[] = []

  const ops = computeOperasional(c, a, unit)
  const incentive = computeIncentive(c, activity, unit)
  const visit = computeVisitBonus(c, activity)

  lines.push({ code: 'GAJI_POKOK', label: 'Gaji Pokok', kind: 'earning', amount: c.gaji_pokok, detail: 'Sesuai data kompensasi' })
  lines.push({ code: 'TJ_JABATAN', label: 'Tunjangan Jabatan', kind: 'earning', amount: c.tj_jabatan, detail: 'Sesuai data kompensasi' })
  if (ops.amount >= 0) {
    lines.push({ code: 'OPERASIONAL', label: 'Tunjangan Operasional', kind: 'earning', amount: ops.amount, detail: ops.detail })
  } else {
    // Masseur rule goes negative when days are missed — show it as a deduction.
    lines.push({ code: 'OPERASIONAL', label: 'Tunjangan Operasional', kind: 'earning', amount: 0, detail: ops.detail })
    lines.push({ code: 'POTONGAN_KEHADIRAN', label: 'Potongan Kehadiran', kind: 'deduction', amount: -ops.amount, detail: ops.detail })
  }
  lines.push({ code: 'INSENTIF', label: 'Tunjangan Insentif', kind: 'earning', amount: incentive.base + incentive.bonus, detail: incentive.detail })
  lines.push({ code: 'VISIT', label: 'Bonus Visit', kind: 'earning', amount: visit.amount, detail: visit.detail })

  for (const adj of adjustments.filter((x) => x.direction === 'credit')) {
    lines.push({
      code: `ADJ_${adj.id ?? adj.category}`,
      label: `${ADJUSTMENT_CATEGORY_LABEL[adj.category]}: ${adj.keterangan}`,
      kind: 'earning',
      amount: adj.amount,
      detail: 'Penyesuaian manual',
    })
  }

  lines.push(...computeDeductionLines(deductionRules, c, a))

  const debits = adjustments.filter((x) => x.direction === 'debit')
  for (const adj of debits) {
    lines.push({
      code: `ADJ_${adj.id ?? adj.category}`,
      label: ADJUSTMENT_CATEGORY_LABEL[adj.category],
      kind: 'deduction',
      amount: adj.amount,
      detail: adj.keterangan,
    })
  }

  const gross = lines.filter((l) => l.kind === 'earning').reduce((s, l) => s + l.amount, 0)
  const totalDeductions = lines.filter((l) => l.kind === 'deduction').reduce((s, l) => s + l.amount, 0)
  const net = floorTo(gross - totalDeductions, unit)

  return {
    lines,
    klinik: c.gaji_pokok + c.tj_jabatan + ops.amount + incentive.base + incentive.bonus,
    visit: visit.amount,
    gross,
    totalDeductions,
    net,
    incentiveQty: incentive.qty,
    notes: debits.map((d) => d.keterangan).filter(Boolean).join('; '),
  }
}

/** Payslip rule: lines whose value is zero are not printed. */
export function visibleSlipLines(lines: PayrollLine[]): PayrollLine[] {
  return lines.filter((l) => Math.round(l.amount) !== 0)
}

/** Picks the compensation version in force at `onDate` (latest effective_from ≤ onDate). */
export function pickCompensation<T extends { effective_from: string }>(versions: T[], onDate: string): T | null {
  let best: T | null = null
  for (const v of versions) {
    if (v.effective_from <= onDate && (!best || v.effective_from > best.effective_from)) best = v
  }
  return best
}

export interface ValidationWarning {
  field: string
  message: string
}

/** Inline warnings for abnormal entries (spec §4.3). Never blocks saving. */
export function validateEmployeeInputs(params: {
  attendance: AttendanceSummary
  activity: Record<string, number>
  activityLimits: Record<string, { label: string; max: number }>
  maxLateDays: number
  missingCompensation: boolean
}): ValidationWarning[] {
  const w: ValidationWarning[] = []
  const { attendance: a } = params
  if (params.missingCompensation) w.push({ field: 'compensation', message: 'Belum ada data kompensasi yang berlaku untuk periode ini' })
  if (a.lateDays > params.maxLateDays) w.push({ field: 'late', message: `Terlambat ${a.lateDays} kali (batas ${params.maxLateDays})` })
  const recorded = a.hadir + a.izin + a.sakit + a.cuti + a.alfa
  if (recorded < a.workdays) w.push({ field: 'attendance', message: `Absensi belum lengkap: ${recorded}/${a.workdays} hari terisi` })
  if (a.hadir > a.workdays) w.push({ field: 'attendance', message: `Hadir ${a.hadir} hari melebihi ${a.workdays} hari kerja` })
  for (const [code, qty] of Object.entries(params.activity)) {
    const lim = params.activityLimits[code]
    if (lim && qty > lim.max) w.push({ field: code, message: `${lim.label}: ${qty} melebihi batas wajar ${lim.max}` })
  }
  return w
}
