import { describe, expect, it } from 'vitest'
import { buildTokoIncomePayload, tokoSaleDescription, type PaidLink } from './payload'

const link: PaidLink = {
  id: 'l1', branch_id: 'b-link', patient_id: null, visit_id: null, order_id: null, method: 'VA',
  amount: 85_000, harga: 85_000, discount: 0, category: 'TOKO', description: null,
  invoice_number: 'GS261009ABCDEFGH', created_by: 'u1',
}
const paid = { paidAt: '2026-10-08T18:30:00Z', reference: '8800123', channelLabel: 'VA BRI' }

describe('tokoSaleDescription', () => {
  it('matches the cash-sale wording', () => {
    expect(tokoSaleDescription([{ product_name: 'Buku A', qty: 2 }])).toBe('Buku A ×2')
    expect(tokoSaleDescription([{ product_name: 'Buku A', qty: 1 }, { product_name: 'Bola', qty: 3 }])).toBe('2 item · Buku A dll.')
    expect(tokoSaleDescription([])).toBe('Penjualan toko')
  })
})

describe('buildTokoIncomePayload', () => {
  const sale = { branch_id: 'b-sale', patient_id: 'p1', total: 85_000, items: [{ product_name: 'Kinesio Tape', qty: 1 }] }

  it('records a confirmed TOKO income on the sale’s branch, never a visit/order', () => {
    const p = buildTokoIncomePayload(link, sale, paid)
    expect(p).toMatchObject({
      type: 'income', category: 'TOKO', status: 'confirmed', payment_method: 'DOKU VA', payment_status: 'LUNAS',
      harga: 85_000, amount: 85_000, discount: 0, branch_id: 'b-sale', patient_id: 'p1',
      visit_id: null, order_id: null, fisio_id: null, transaction_date: '2026-10-09',
      recorded_by: 'u1', confirmed_by: 'u1',
    })
    expect(p.description).toBe('Kinesio Tape ×1 · DOKU GS261009ABCDEFGH · VA BRI · ref 8800123')
  })

  it('QRIS links record DOKU QRIS', () => {
    expect(buildTokoIncomePayload({ ...link, method: 'QRIS' }, sale, paid).payment_method).toBe('DOKU QRIS')
  })
})
