import type { JadwalListRow } from './types'

const KEHADIRAN_LABEL: Record<string, string> = { HADIR: 'Hadir', 'TIDAK HADIR': 'Tidak Hadir' }

/** Cell value per List Jadwal column — what the header filters match and sort on. */
export const JADWAL_LIST_COLUMNS: Record<string, (r: JadwalListRow) => string | number | null | undefined> = {
  tanggal:      (r) => `${r.visit_date} ${r.visit_time ?? ''}`,
  jam:          (r) => r.visit_time,
  pasien:       (r) => r.patient_name,
  umur:         (r) => (r.patient_age ? parseInt(r.patient_age, 10) || null : null),
  fisio:        (r) => r.attending_staff_name,
  layanan:      (r) => r.layanan_label,
  kategori:     (r) => r.kategori,
  pertemuan:    (r) => r.pertemuan_ke,
  kurang_bayar: (r) => r.kurang_bayar,
  kehadiran:    (r) => (r.kehadiran ? KEHADIRAN_LABEL[r.kehadiran] ?? r.kehadiran : 'Belum Diisi'),
  status:       (r) => r.admin_status,
}
