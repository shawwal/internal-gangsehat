// ── Supabase public tables (READ ONLY) ──────────────────────────────────────

export type UserRole = 'patient' | 'admin' | 'therapist'
export type InternalRole = 'admin' | 'manager' | 'owner' | 'fisioterapis'

export interface Profile {
  id: string
  email: string
  full_name: string
  phone: string
  role: UserRole
}

export interface Patient {
  id: string
  profile_id: string
  encrypted_name: string
  encrypted_phone: string
  gender: string
  blood_type: string
  member_type_id: string | null
}

export type BookingStatus =
  | 'waiting_confirmation'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface Booking {
  id: string
  patient_id: string | null
  therapist_id: string | null
  service_type: string
  scheduled_date: string
  scheduled_time: string
  status: BookingStatus
  estimated_price: number | null
  discounted_price: number | null
  discount_percentage: number | null
  payment_method: string | null
  guest_name: string | null
  guest_phone: string | null
  admin_notes: string | null
  created_at: string
}

// Joined result type used in the order list query
export interface BookingRow extends Booking {
  patients: { encrypted_name: string; encrypted_phone: string } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  therapists: any | null
  internal_order_meta: Array<{
    id: string
    kode_transaksi: string
    status_bayar: 'Belum Lunas' | 'Lunas'
    catatan_admin: string | null
  }>
}

// ── Internal tables ──────────────────────────────────────────────────────────

export interface InternalJabatan {
  id: string
  nama: string        // position name
  created_at: string
}

export interface InternalUser {
  id: string
  profile_id: string
  jabatan_id: string | null
  is_active: boolean
  created_at: string
}

export interface InternalLayanan {
  id: string
  nama: string
  kategori: string
  jumlah_sesi: number | null
  harga: number
  is_active: boolean
  created_at: string
}

export type ShiftType = 'PAGI' | 'SORE'

export interface InternalJamShift {
  id: string
  shift: ShiftType
  jam_mulai: string   // start_time
  jam_selesai: string // end_time
  created_at: string
}

export interface InternalMasterJadwal {
  id: string
  therapist_id: string
  hari: string        // day of week
  shift: ShiftType
  created_at: string
}

export type JadwalStatus = 'TERSEDIA' | 'OFF' | 'CUTI' | 'MASUK'

export interface InternalJadwal {
  id: string
  therapist_id: string
  tanggal: string     // date
  shift: ShiftType
  status: JadwalStatus
  created_at: string
}

export type CutiStatus = 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK'

export interface InternalCuti {
  id: string
  user_id: string
  tanggal_mulai: string
  tanggal_selesai: string
  alasan: string
  bukti_url: string | null
  status: CutiStatus
  disetujui_oleh: string | null
  created_at: string
}

export interface InternalTarget {
  id: string
  therapist_id: string
  bulan: number
  tahun: number
  target_terapi_awal: number
  target_paket_klinik: number
  target_kunjungan: number
  target_homevisit_paket: number
  approved: boolean
  created_at: string
}

export interface InternalOrderMeta {
  id: string
  booking_id: string
  kode_transaksi: string  // TRX/YYYY/MM/NNNN
  status_bayar: 'Belum Lunas' | 'Lunas'
  catatan_admin: string | null
  created_at: string
}

export interface InternalWilayah {
  id: string
  kode: string
  nama: string
  tipe: 'provinsi' | 'kabupaten' | 'kecamatan' | 'kelurahan'
  parent_id: string | null
}

export interface InternalReferensi {
  id: string
  kunci: string       // ref_key
  nilai: string       // ref_value
  tipe: string
  grup: string | null
  created_at: string
}

export interface InternalKonfigurasi {
  id: string
  kunci: string
  nilai: string
  updated_at: string
}
