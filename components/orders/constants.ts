export const PAGE_SIZE = 15

export const MONTHS = [
  { value: '', label: 'Semua Bulan' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2024, i, 1).toLocaleDateString('id-ID', { month: 'long' }),
  })),
]

export const YEARS = Array.from({ length: 4 }, (_, i) => {
  const y = new Date().getFullYear() - i
  return { value: String(y), label: String(y) }
})

export const STATUS_OPTIONS = [
  { value: '',                     label: 'Semua Status' },
  { value: 'waiting_confirmation', label: 'Booking' },
  { value: 'confirmed',            label: 'Confirmed' },
  { value: 'in_progress',          label: 'In Progress' },
  { value: 'completed',            label: 'Selesai' },
  { value: 'cancelled',            label: 'Batal' },
]

export const PAYMENT_OPTIONS = [
  { value: '',            label: 'Semua Pembayaran' },
  { value: 'Belum Lunas', label: 'Belum Lunas' },
  { value: 'Lunas',       label: 'Lunas' },
]
