import { describe, expect, it } from 'vitest'
import {
  PAYMENT_PROOF_REQUIRED_MSG,
  isPaymentProofRequiredOnEdit,
  isValidPaymentProofPath,
  paymentProofError,
  requiresPaymentProof,
} from './paymentProof'

const PATH = '2026/10/1759561234567-ab12cd34.webp'

describe('requiresPaymentProof', () => {
  it('requires proof for transfer methods', () => {
    expect(requiresPaymentProof('TRANSFER BCA')).toBe(true)
    expect(requiresPaymentProof('TRANSFER BANK KALBAR')).toBe(true)
    expect(requiresPaymentProof('Non Tunai - BCA')).toBe(true)
    expect(requiresPaymentProof('Non Tunai - QRIS')).toBe(true)
  })

  it('does not require proof for cash, EDC, or no method', () => {
    expect(requiresPaymentProof('TUNAI')).toBe(false)
    expect(requiresPaymentProof('Tunai')).toBe(false)
    expect(requiresPaymentProof('EDC BCA')).toBe(false)
    expect(requiresPaymentProof(null)).toBe(false)
    expect(requiresPaymentProof('')).toBe(false)
  })
})

describe('isValidPaymentProofPath', () => {
  it('accepts generated paths', () => {
    expect(isValidPaymentProofPath(PATH)).toBe(true)
  })

  it('rejects other shapes', () => {
    expect(isValidPaymentProofPath(null)).toBe(false)
    expect(isValidPaymentProofPath('2026/10/x.png')).toBe(false)
    expect(isValidPaymentProofPath('../leave-proofs/x.webp')).toBe(false)
    expect(isValidPaymentProofPath('https://example.com/x.webp')).toBe(false)
  })
})

describe('paymentProofError', () => {
  it('requires a proof for new transfer payments', () => {
    expect(paymentProofError('TRANSFER BCA', null)).toBe(PAYMENT_PROOF_REQUIRED_MSG)
    expect(paymentProofError('TRANSFER BCA', PATH)).toBeNull()
  })

  it('allows cash without a proof but rejects malformed paths', () => {
    expect(paymentProofError('TUNAI', null)).toBeNull()
    expect(paymentProofError('TUNAI', 'bad')).not.toBeNull()
  })
})

describe('isPaymentProofRequiredOnEdit', () => {
  it('requires a proof when switching to transfer', () => {
    expect(isPaymentProofRequiredOnEdit({ method: 'TUNAI', proofPath: null }, 'TRANSFER BCA')).toBe(true)
  })

  it('keeps an existing proof required (replace, not drop)', () => {
    expect(isPaymentProofRequiredOnEdit({ method: 'TRANSFER BCA', proofPath: PATH }, 'TRANSFER BCA')).toBe(true)
  })

  it('lets legacy transfer rows without a proof be edited', () => {
    expect(isPaymentProofRequiredOnEdit({ method: 'TRANSFER BCA', proofPath: null }, 'TRANSFER BCA')).toBe(false)
  })

  it('never requires a proof for non-transfer methods', () => {
    expect(isPaymentProofRequiredOnEdit({ method: 'TRANSFER BCA', proofPath: PATH }, 'TUNAI')).toBe(false)
  })
})
