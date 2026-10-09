import { describe, expect, it } from 'vitest'
import { orderBills, visitBill, type OutstandingEntry } from './bills'

const outstanding: OutstandingEntry[] = [
  { order_id: 'ORD-1', category: 'PAKET KLINIK', harga: 1_000_000, discount: 0, outstanding: 400_000 },
  { order_id: null, category: 'SESI KLINIK', harga: 150_000, discount: 0, outstanding: 50_000 },
  { order_id: 'ORD-2', category: 'PAKET VISIT', harga: 2_000_000, discount: 100_000, outstanding: 900_000 },
  { order_id: 'ORD-3', category: 'PAKET KLINIK', harga: 500_000, discount: 0, outstanding: 0 },
]

describe('visitBill', () => {
  it('prices a visit from the price list', () => {
    expect(visitBill({ visitId: 'v1', category: 'SESI KLINIK', price: 150_000 })).toMatchObject({
      key: 'visit:v1', amount: 150_000, harga: 150_000, category: 'SESI KLINIK', visitId: 'v1',
    })
  })
  it('skips packages and unknown prices', () => {
    expect(visitBill({ visitId: 'v1', category: 'PAKET KLINIK', price: 900_000 })).toBeNull()
    expect(visitBill({ visitId: 'v1', category: 'SESI KLINIK', price: null })).toBeNull()
    expect(visitBill({ visitId: 'v1', category: 'SESI KLINIK', price: 0 })).toBeNull()
  })
})

describe('orderBills', () => {
  const visit = visitBill({ visitId: 'v1', category: 'SESI KLINIK', price: 150_000 })

  it('puts this visit first, then open order balances only', () => {
    const bills = orderBills(visit, outstanding)
    expect(bills.map((b) => b.key)).toEqual(['visit:v1', 'order:ORD-1', 'order:ORD-2'])
    expect(bills[1]).toMatchObject({ amount: 400_000, orderId: 'ORD-1', label: 'Sisa PAKET KLINIK' })
  })

  it('moves the host’s order to the front', () => {
    expect(orderBills(visit, outstanding, 'ORD-2')[0].key).toBe('order:ORD-2')
  })

  it('works without a visit bill', () => {
    expect(orderBills(null, outstanding).map((b) => b.key)).toEqual(['order:ORD-1', 'order:ORD-2'])
    expect(orderBills(null, [])).toEqual([])
  })
})
