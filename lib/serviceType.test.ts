import { describe, expect, it } from 'vitest'
import { branchIncomeKategori } from './serviceType'

const l = (kategori: string, is_active = true) => ({ kategori, is_active })

describe('branchIncomeKategori', () => {
  it('lists active built-in kategori in order, then LAINNYA', () => {
    expect(branchIncomeKategori([l('PAKET KLINIK'), l('TERAPI AWAL KLINIK'), l('SESI VISIT', false)]))
      .toEqual(['TERAPI AWAL KLINIK', 'PAKET KLINIK', 'LAINNYA'])
  })

  it('keeps kategori added in Tarif Layanan, after the built-in ones', () => {
    expect(branchIncomeKategori([l('TERAPI WICARA'), l('SESI KLINIK'), l('AKUPUNTUR'), l('TOKO')]))
      .toEqual(['SESI KLINIK', 'AKUPUNTUR', 'TERAPI WICARA', 'LAINNYA'])
  })
})
