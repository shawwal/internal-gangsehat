import { describe, expect, it } from 'vitest'
import { paymentActivityHits, paymentModeCodes, sumPaymentHits, type PaymentForPayroll } from './paymentActivity'

const JARAK_PAKET = { nama: 'Paket Home Visit Fisioterapi + Jarak', payroll_units: { VISIT_PT: 1, VISIT_JARAK: 10 } }
const TA_JARAK = { nama: 'Terapi Awal Home Visit Fisioterapi + Jarak', payroll_units: { VISIT_TA: 1, VISIT_JARAK: 1 } }

const pay = (over: Partial<PaymentForPayroll>): PaymentForPayroll => ({
  id: Math.random().toString(36), staff_id: 'a', patient_id: 'p', transaction_date: '2026-10-01',
  payment_status: 'LUNAS', layanan: TA_JARAK, ...over,
})

describe('payroll activity from payments', () => {
  it('collects the codes a branch tags on its Layanan', () => {
    expect([...paymentModeCodes([{ payroll_units: JARAK_PAKET.payroll_units }, { payroll_units: {} }, { payroll_units: null }])].sort())
      .toEqual(['VISIT_JARAK', 'VISIT_PT'])
  })

  it('counts LUNAS / PELUNASAN only, with Layanan units, credited to the Fisio', () => {
    const codes = new Set(['VISIT_TA', 'VISIT_PT', 'VISIT_JARAK'])
    const counts = sumPaymentHits(paymentActivityHits({
      codes, staffIds: ['a', 'b'],
      payments: [
        pay({}),
        pay({ layanan: JARAK_PAKET, payment_status: 'PELUNASAN' }),
        pay({ layanan: JARAK_PAKET, payment_status: 'DP' }),       // fee waits for PELUNASAN
        pay({ staff_id: 'b', layanan: { nama: 'Terapi Awal Home Visit Fisioterapi', payroll_units: { VISIT_TA: 1 } } }),
        pay({ staff_id: null }),                                    // no Fisio
        pay({ staff_id: 'x' }),                                     // not in this period
        pay({ layanan: null }),                                     // Layanan unresolved
      ],
    }))
    expect(counts).toEqual({ a: { VISIT_TA: 1, VISIT_PT: 1, VISIT_JARAK: 11 }, b: { VISIT_TA: 1 } })
  })
})
