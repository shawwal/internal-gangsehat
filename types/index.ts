export type UserRole = 'director' | 'finance' | 'hr' | 'marketing' | 'staff' | 'therapist' | 'manager'

export interface Branch {
  id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  branch_id: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  name: string
  phone: string
  address: string | null
  birthDate: string | null
  gender: 'male' | 'female' | 'other' | null
  isActive: boolean
  createdAt: string
  // Additional demographics (migration 022)
  no_rm: string | null
  pekerjaan: string | null
  agama: string | null
  hobi: string | null
  kelurahan: string | null
  kecamatan: string | null
  kabupaten_kota: string | null
  provinsi: string | null
}

export type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

// Service types (LAYANAN) — maps to Excel purchase codes:
// K.TA → TERAPI AWAL, K.ST → SESI TERAPI, K.PT → PAKET TERAPI
// V.TA → TA VISIT, V.ST → SESI VISIT, V.PT → PAKET VISIT
export type ServiceType =
  | 'TERAPI AWAL'
  | 'PAKET TERAPI'
  | 'SESI TERAPI'
  | 'TA VISIT'
  | 'SESI VISIT'
  | 'PAKET VISIT'
  | 'LAINNYA'

export type BodyRegion =
  | 'HEAD' | 'NECK' | 'SHOULDER' | 'UPPER ARM' | 'ELBOW' | 'LOWER ARM'
  | 'WRIST' | 'HAND' | 'SPINE' | 'CHEST' | 'UPPER BACK' | 'LOWER BACK'
  | 'ABDOMINAL' | 'HIP/PELVIC' | 'THIGH' | 'KNEE' | 'CALF' | 'ANKLE'
  | 'FOOT' | 'CNS' | 'PNS' | 'SYSTEMIC' | 'CARDIOVASCULAR' | 'PULMONAL' | 'PERFORMANCE'

export interface PatientVisit {
  id: string
  patient_id: string
  branch_id: string
  visit_date: string
  visit_time: string | null
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  attending_staff_id: string | null
  status: VisitStatus
  notes: string | null
  created_at: string
  updated_at: string
  // Clinical enrichment fields (migration 021)
  service_type: ServiceType | null
  shift: 'PAGI' | 'SORE' | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null  // attendance — distinct from `status` workflow
  regio: BodyRegion | null
  sumber_pasien: string | null
}

export type TransactionType = 'income' | 'expense'
export type TransactionStatus = 'pending' | 'confirmed' | 'rejected'

// Payment method (METODE BAYAR in finance Excel)
export type PaymentMethod = 'TUNAI' | 'TRANSFER BCA' | 'EDC BCA'

// Payment detail status (KETERANGAN BAYAR) — independent of approval `status`
// LUNAS = fully paid, DP = down payment, PELUNASAN = final/settlement payment
export type PaymentDetailStatus = 'LUNAS' | 'DP' | 'PELUNASAN'

export interface Transaction {
  id: string
  branch_id: string
  patient_id: string | null
  visit_id: string | null
  type: TransactionType
  category: string
  amount: number                        // amount paid (JUMLAH BAYAR)
  description: string | null
  receipt_url: string | null
  status: TransactionStatus             // approval workflow: pending → confirmed/rejected
  rejection_reason: string | null
  recorded_by: string | null
  confirmed_by: string | null
  transaction_date: string
  created_at: string
  updated_at: string
  // Payment enrichment fields (migration 020)
  harga: number                         // full price (HARGA)
  discount: number                      // discount given (DISKON)
  outstanding: number                   // computed: max(harga - amount - discount, 0)
  payment_method: PaymentMethod | null  // METODE BAYAR
  payment_status: PaymentDetailStatus | null  // KETERANGAN BAYAR
  penjamin: string | null               // guarantor name (can differ from patient)
  fisio_id: string | null               // FK to internal_profiles — treating therapist
}

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface BranchFinancialReport {
  id: string
  branch_id: string
  period_year: number
  period_month: number
  total_income: number
  total_expense: number
  net_profit: number
  patient_count: number
  visit_count: number
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  status: ReportStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type JenisPaket = 'P1' | 'P2'
export type PackageOperationalStatus = 'ON' | 'OFF' | 'PENDING'
export type PackageCompletionStatus = 'LANJUT' | 'SEMBUH' | 'TIDAK LANJUT' | 'STOP'

export type PackageType = 'fixed' | 'flexible'
export type PackageStatus = 'active' | 'completed' | 'cancelled'

export interface PatientPackage {
  id: string
  patient_id: string
  branch_id: string | null
  package_name: string
  package_type: PackageType
  total_sessions: number
  used_sessions: number       // computed from patient_visits via view
  remaining_sessions: number  // computed: total_sessions - used_sessions
  notes: string | null
  status: PackageStatus
  jenis_paket: JenisPaket | null
  mulai_paket: 'NEW' | 'EXT.' | null
  operational_status: PackageOperationalStatus
  completion_status: PackageCompletionStatus | null
  created_at: string
  updated_at: string
}

export interface PackageSession {
  id: string
  visit_date: string
  service_type: string
  shift: 'PAGI' | 'SORE' | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null
  status: string
  therapist_name: string | null
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick'

export interface Attendance {
  id: string
  staff_id: string
  branch_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export type CampaignChannel = 'social_media' | 'whatsapp' | 'email' | 'flyer' | 'other'
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface Campaign {
  id: string
  branch_id: string
  title: string
  description: string | null
  channel: CampaignChannel | null
  start_date: string | null
  end_date: string | null
  budget: number
  actual_spend: number
  target_reach: number | null
  actual_reach: number | null
  status: CampaignStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface UserNotification {
  id: string
  user_id: string | null
  target_role: UserRole | null
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}
