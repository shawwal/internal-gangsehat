'use server'

import { createClient } from '@/lib/supabase/server'

const SERVICE_TO_CATEGORY: Record<string, string> = {
  'TERAPI AWAL':  'TA KLINIK',
  'SESI TERAPI':  'SESI KLINIK',
  'PAKET TERAPI': 'PAKET KLINIK',
  'TA VISIT':     'TA VISIT',
  'SESI VISIT':   'SESI VISIT',
  'PAKET VISIT':  'PAKET VISIT',
  'LAINNYA':      'LAINNYA',
}

const PAYMENT_ROLES = ['finance', 'manager', 'director']

export interface OutstandingTransaction {
  id: string
  transaction_date: string
  category: string
  harga: number
  amount: number
  discount: number
  outstanding: number
  payment_status: string | null
}

export async function getPatientOutstanding(patientId: string): Promise<OutstandingTransaction[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('transactions')
    .select('id, transaction_date, category, harga, amount, discount, outstanding, payment_status')
    .eq('patient_id', patientId)
    .eq('type', 'income')
    .neq('status', 'rejected')
    .gt('outstanding', 0)
    .order('transaction_date', { ascending: false })
  return (data ?? []) as OutstandingTransaction[]
}

export interface CreateTransactionInput {
  harga: number
  discount: number
  amount: number
  payment_method: string
  payment_status: string
  penjamin: string | null
  description: string | null
  transaction_date: string
}

export async function createTransactionForVisit(
  visitId: string,
  input: CreateTransactionInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !PAYMENT_ROLES.includes(profile.role)) {
    return { error: 'Tidak memiliki akses untuk mencatat pembayaran' }
  }

  const { data: visit, error: visitErr } = await supabase
    .from('patient_visits')
    .select('patient_id, branch_id, attending_staff_id, service_type')
    .eq('id', visitId)
    .single()

  if (visitErr || !visit) return { error: 'Kunjungan tidak ditemukan' }

  const category = SERVICE_TO_CATEGORY[visit.service_type ?? ''] ?? 'LAINNYA'

  const { error } = await supabase.from('transactions').insert({
    visit_id:         visitId,
    patient_id:       visit.patient_id,
    branch_id:        visit.branch_id,
    fisio_id:         visit.attending_staff_id,
    type:             'income',
    category,
    harga:            input.harga,
    discount:         input.discount,
    amount:           input.amount,
    payment_method:   input.payment_method,
    payment_status:   input.payment_status,
    penjamin:         input.penjamin,
    description:      input.description,
    transaction_date: input.transaction_date,
    status:           'pending',
    recorded_by:      user.id,
    updated_at:       new Date().toISOString(),
  })

  return { error: error?.message ?? null }
}
