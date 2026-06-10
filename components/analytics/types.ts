export type Tab = 'keuangan' | 'kunjungan' | 'cabang' | 'target'
export type ChartType = 'bar' | 'line' | 'pie'

export interface MonthlyFinance {
  month: string
  Pemasukan: number
  Pengeluaran: number
  'Laba Bersih': number
}

export interface MonthlyVisit {
  month: string
  Selesai: number
  Terjadwal: number
  Dibatalkan: number
  'Tidak Hadir': number
}

export interface BranchData {
  name: string
  Pemasukan: number
  Pengeluaran: number
  'Laba Bersih': number
}

export interface MonthlyTarget {
  month: string
  Disetujui: number
  Ditolak: number
  Menunggu: number
}

export interface KPI {
  pemasukan: number
  pengeluaran: number
  profit: number
  kunjungan: number
  prevPemasukan: number | null
  prevPengeluaran: number | null
  prevProfit: number | null
  prevKunjungan: number | null
}

export interface Branch {
  id: string
  name: string
}
