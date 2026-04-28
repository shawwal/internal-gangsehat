export type UserRole = 'director' | 'finance' | 'hr' | 'marketing'

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
  branch_id: string
  full_name: string
  date_of_birth: string | null
  gender: 'male' | 'female' | 'other' | null
  phone: string | null
  email: string | null
  address: string | null
  medical_record_number: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface PatientVisit {
  id: string
  patient_id: string
  branch_id: string
  visit_date: string
  chief_complaint: string | null
  diagnosis: string | null
  treatment: string | null
  attending_staff_id: string | null
  status: VisitStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type TransactionType = 'income' | 'expense'
export type TransactionStatus = 'pending' | 'confirmed' | 'rejected'

export interface Transaction {
  id: string
  branch_id: string
  patient_id: string | null
  visit_id: string | null
  type: TransactionType
  category: string
  amount: number
  description: string | null
  receipt_url: string | null
  status: TransactionStatus
  rejection_reason: string | null
  recorded_by: string | null
  confirmed_by: string | null
  transaction_date: string
  created_at: string
  updated_at: string
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
