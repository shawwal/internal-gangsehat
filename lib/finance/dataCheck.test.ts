import { describe, expect, it } from 'vitest'
import { isTherapistCategory, txIssues } from './dataCheck'

const tx = (over: Partial<Parameters<typeof txIssues>[0]>) => ({
  category: 'PAKET KLINIK', patient_id: 'p1', payment_status: 'LUNAS', payment_method: 'TUNAI',
  receipt_url: null, therapist_id: null, ...over,
})

describe('Fisio rule', () => {
  it('every income except TOKO needs a Fisio (empty category = LAINNYA)', () => {
    for (const c of ['TERAPI AWAL KLINIK', 'PAKET KLINIK', 'SESI VISIT', 'SPORT MASSAGE', 'LAINNYA', '', null]) expect(isTherapistCategory(c)).toBe(true)
    expect(isTherapistCategory('TOKO')).toBe(false)
  })

  it('flags a missing Fisio on LAINNYA but not on TOKO', () => {
    expect(txIssues(tx({ category: 'LAINNYA' }))).toContain('tanpa_fisio')
    expect(txIssues(tx({ category: 'TOKO', patient_id: null }))).toEqual([])
    expect(txIssues(tx({ therapist_id: 's1' }))).toEqual([])
  })
})
