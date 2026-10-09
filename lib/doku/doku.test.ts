import { createHash, createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOKU_NOTIFICATION_PATH, digestOf, normalizeOrder, sanitize, signature, validNotification } from './client'
import { DEFAULT_VA_TYPES, paymentMethodTypes } from './channels'
import { isOurInvoice, newInvoiceNumber } from './invoice'
import { buildIncomePayload, paymentStatusFor, type PaidLink } from './payload'
import { receiptPath, buildReceiptPdf } from './receipt'
import { isGatewayPayment, isGatewayReceiptPath, proofBucketFor } from '@/lib/paymentProof'

describe('signature', () => {
  it('matches DOKU’s HMAC-SHA256 component string', () => {
    const body = '{"order":{"invoice_number":"GS261009ABCDEFGH"}}'
    const digest = createHash('sha256').update(body).digest('base64')
    const component =
      'Client-Id:MCH-1\nRequest-Id:req-1\nRequest-Timestamp:2026-10-09T01:02:03Z\nRequest-Target:/checkout/v1/payment\nDigest:' + digest
    const expected = 'HMACSHA256=' + createHmac('sha256', 'secret').update(component).digest('base64')
    expect(signature({
      clientId: 'MCH-1', requestId: 'req-1', requestTimestamp: '2026-10-09T01:02:03Z',
      requestTarget: '/checkout/v1/payment', digest: digestOf(body),
    }, 'secret')).toBe(expected)
  })

  it('omits the Digest line for body-less requests', () => {
    const component = 'Client-Id:a\nRequest-Id:b\nRequest-Timestamp:c\nRequest-Target:/orders/v1/status/X'
    expect(signature({ clientId: 'a', requestId: 'b', requestTimestamp: 'c', requestTarget: '/orders/v1/status/X' }, 'k'))
      .toBe('HMACSHA256=' + createHmac('sha256', 'k').update(component).digest('base64'))
  })
})

describe('validNotification', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.DOKU_CLIENT_ID_DEVELOPMENT = 'MCH-DEV'
    process.env.DOKU_SECRET_KEY_DEVELOPMENT = 'dev-secret'
  })
  afterEach(() => { process.env = { ...env } })

  const body = '{"order":{"invoice_number":"GS261009ABCDEFGH"},"transaction":{"status":"SUCCESS"}}'
  const headers = (sig: string, clientId = 'MCH-DEV') => ({
    clientId, requestId: 'n-1', requestTimestamp: '2026-10-09T01:02:03Z', signature: sig,
  })
  const good = () => signature({
    clientId: 'MCH-DEV', requestId: 'n-1', requestTimestamp: '2026-10-09T01:02:03Z',
    requestTarget: DOKU_NOTIFICATION_PATH, digest: digestOf(body),
  }, 'dev-secret')

  it('accepts a correctly signed notification', () => {
    expect(validNotification(headers(good()), body, 'development')).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(validNotification(headers(good()), body.replace('SUCCESS', 'FAILED'), 'development')).toBe(false)
  })
  it('rejects another client id', () => {
    expect(validNotification(headers(good(), 'MCH-OTHER'), body, 'development')).toBe(false)
  })
  it('rejects missing headers and unconfigured modes', () => {
    expect(validNotification({ ...headers(good()), signature: null }, body, 'development')).toBe(false)
    expect(validNotification(headers(good()), body, 'production')).toBe(false)
  })
})

describe('normalizeOrder', () => {
  const future = new Date(Date.now() + 3_600_000)
  it('maps SUCCESS to PAID with channel and VA reference', () => {
    const o = normalizeOrder({
      order: { amount: '150000' }, transaction: { status: 'SUCCESS', date: '2026-10-09T03:00:00Z' },
      channel: { id: 'VIRTUAL_ACCOUNT_BRI' }, virtual_account_info: { virtual_account_number: '1234567890' },
    }, future)
    expect(o).toMatchObject({ status: 'PAID', amount: 150000, channel: 'VIRTUAL_ACCOUNT_BRI', reference: '1234567890' })
  })
  it('keeps FAILED attempts pending until expiry', () => {
    expect(normalizeOrder({ transaction: { status: 'FAILED' } }, future).status).toBe('PENDING')
  })
  it('expires on DOKU EXPIRED / ORDER_EXPIRED or our own expiry (+grace)', () => {
    expect(normalizeOrder({ transaction: { status: 'EXPIRED' } }, future).status).toBe('EXPIRED')
    expect(normalizeOrder({ order: { status: 'ORDER_EXPIRED' } }, future).status).toBe('EXPIRED')
    expect(normalizeOrder({}, new Date(Date.now() - 11 * 60_000)).status).toBe('EXPIRED')
    expect(normalizeOrder({}, new Date(Date.now() - 5 * 60_000)).status).toBe('PENDING')
  })
})

describe('invoice numbers', () => {
  it('are GS-prefixed, ≤ 64 chars and recognisable', () => {
    const inv = newInvoiceNumber(new Date('2026-10-08T20:00:00Z')) // 09 Oct in Jakarta
    expect(inv).toMatch(/^GS261009[A-Z2-9]{8}$/)
    expect(isOurInvoice(inv)).toBe(true)
    expect(isOurInvoice('0f8fad5bd9cb469fa16570867728950e')).toBe(false) // human-atlas style
    expect(newInvoiceNumber()).not.toBe(newInvoiceNumber())
  })
})

describe('channels', () => {
  it('QRIS only offers QRIS; VA defaults exclude BCA; env override wins', () => {
    expect(paymentMethodTypes('QRIS')).toEqual(['QRIS'])
    expect(paymentMethodTypes('VA')).toEqual(DEFAULT_VA_TYPES)
    expect(DEFAULT_VA_TYPES).not.toContain('VIRTUAL_ACCOUNT_BCA')
    expect(paymentMethodTypes('VA', 'VIRTUAL_ACCOUNT_BCA, VIRTUAL_ACCOUNT_BRI')).toEqual(['VIRTUAL_ACCOUNT_BCA', 'VIRTUAL_ACCOUNT_BRI'])
  })
  it('sanitize strips characters DOKU rejects', () => {
    expect(sanitize('Paket #1 — Ibu Ani & anak')).toBe('Paket -1 - Ibu Ani - anak')
  })
})

describe('buildIncomePayload', () => {
  const link: PaidLink = {
    id: 'l1', branch_id: 'b1', patient_id: 'p1', visit_id: null, order_id: null, method: 'QRIS',
    amount: 200000, harga: 0, discount: 0, category: 'SESI KLINIK', description: null,
    invoice_number: 'GS261009ABCDEFGH', created_by: 'u1',
  }
  const paid = { paidAt: '2026-10-08T18:30:00Z', reference: 'REF1', channelLabel: 'QRIS' }

  it('standalone link → confirmed LUNAS income dated in Jakarta time', () => {
    const p = buildIncomePayload(link, {}, paid)
    expect(p).toMatchObject({
      type: 'income', status: 'confirmed', payment_method: 'DOKU QRIS', payment_status: 'LUNAS',
      harga: 200000, amount: 200000, patient_id: 'p1', branch_id: 'b1', transaction_date: '2026-10-09',
      recorded_by: 'u1', confirmed_by: 'u1',
    })
    expect(p.description).toContain('GS261009ABCDEFGH')
  })

  it('visit link paying part of the bill → DP, with visit context', () => {
    const p = buildIncomePayload({ ...link, method: 'VA', visit_id: 'v1', harga: 500000, amount: 200000 }, {
      visit: { patient_id: 'p1', branch_id: 'b2', attending_staff_id: 's1', order_id: 'ORD-1' },
    }, paid)
    expect(p).toMatchObject({ payment_method: 'DOKU VA', payment_status: 'DP', branch_id: 'b2', fisio_id: 's1', order_id: 'ORD-1', visit_id: 'v1' })
  })

  it('order installment copies the template and settles to LUNAS / PELUNASAN', () => {
    const order = {
      template: { patient_id: 'p1', branch_id: 'b1', visit_id: 'v0', fisio_id: 's1', category: 'PAKET KLINIK', harga: 1_000_000, discount: 0 },
      totalPaid: 600_000,
    }
    const full = buildIncomePayload({ ...link, order_id: 'ORD-9', amount: 400_000 }, { order }, paid)
    expect(full).toMatchObject({ order_id: 'ORD-9', category: 'PAKET KLINIK', harga: 1_000_000, amount: 400_000, payment_status: 'LUNAS' })
    const part = buildIncomePayload({ ...link, order_id: 'ORD-9', amount: 100_000 }, { order }, paid)
    expect(part.payment_status).toBe('PELUNASAN')
  })

  it('paymentStatusFor', () => {
    expect(paymentStatusFor(100, 10, 90)).toBe('LUNAS')
    expect(paymentStatusFor(100, 0, 50)).toBe('DP')
  })
})

describe('receipts', () => {
  it('paths route to the receipts bucket; DOKU methods are gateway payments', () => {
    const path = receiptPath('GS261009ABCDEFGH', '2026-10-09T03:00:00Z')
    expect(path).toBe('doku/2026/10/GS261009ABCDEFGH.pdf')
    expect(isGatewayReceiptPath(path)).toBe(true)
    expect(proofBucketFor(path)).toBe('payment-receipts')
    expect(proofBucketFor('2026/10/123-abc.webp')).toBe('payment-proofs')
    expect(isGatewayPayment('DOKU QRIS')).toBe(true)
    expect(isGatewayPayment('TRANSFER BCA')).toBe(false)
  })

  it('builds a PDF', () => {
    const pdf = buildReceiptPdf({
      invoiceNumber: 'GS261009ABCDEFGH', branchName: 'Cabang A', branchAddress: 'Jl. Contoh 1', branchPhone: '0812',
      patientName: 'Pasien Uji', noRm: 'Z0922105765', category: 'SESI KLINIK', description: null,
      amount: 150000, harga: 150000, discount: 0, channel: 'QRIS', reference: 'REF', paidAt: '2026-10-09T03:00:00Z',
      environment: 'development',
    })
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-')
  })
})
