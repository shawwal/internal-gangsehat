'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeOrderPaymentSummary, type OrderPaymentSummary, type OrderPaymentRow } from '@/lib/internal/orderPayments'

const SERVICE_TO_CATEGORY: Record<string, string> = {
  'TERAPI AWAL':  'TA KLINIK',
  'SESI TERAPI':  'SESI KLINIK',
  'PAKET TERAPI': 'PAKET KLINIK',
  'TA VISIT':     'TA VISIT',
  'SESI VISIT':   'SESI VISIT',
  'PAKET VISIT':  'PAKET VISIT',
  'LAINNYA':      'LAINNYA',
}

const PAYMENT_ROLES = ['finance', 'manager', 'director', 'admin']
const PACKAGE_CATEGORIES = new Set(['PAKET KLINIK', 'PAKET VISIT'])

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

async function sendPaymentNotification(harga: number, category: string) {
  const admin = createAdminClient()
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  await admin.from('user_notifications').insert([
    {
      target_role: 'director',
      title: 'Pembayaran Baru Dicatat',
      message: `${formatRp(harga)} · ${category} · ${dateStr}`,
      link: '/finance/transactions',
    },
    {
      target_role: 'finance',
      title: 'Pembayaran Baru Dicatat',
      message: `${formatRp(harga)} · ${category} · ${dateStr}`,
      link: '/finance/transactions',
    },
  ])
}

// ── Outstanding ───────────────────────────────────────────────────────────────

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

export async function fetchLayananHarga(serviceType: string, branchId?: string | null, jumlahSesi?: number | null): Promise<number | null> {
  const kategori = SERVICE_TO_CATEGORY[serviceType]
  if (!kategori || kategori === 'LAINNYA') return null
  const supabase = await createClient()
  let query = supabase
    .from('internal_layanan')
    .select('harga')
    .eq('kategori', kategori)
    .eq('is_active', true)
  if (branchId) query = query.eq('branch_id', branchId)
  if (jumlahSesi != null) query = query.eq('jumlah_sesi', jumlahSesi)
  const { data } = await query.order('created_at', { ascending: true }).limit(1).single()
  return data ? Number(data.harga) : null
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

// ── Create transaction linked to a visit (from PaymentDialog) ─────────────────

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
    .select('patient_id, branch_id, attending_staff_id, service_type, order_id')
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
    order_id:         visit.order_id ?? null,
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

  if (error) return { error: error.message }

  await sendPaymentNotification(input.harga, category)
  return { error: null }
}

// ── Payment history / SALDO (order-level) ────────────────────────────────────
// "Pembayaran baru ditambahkan sebagai riwayat, bukan menimpa pembayaran
// sebelumnya" — every payment against an order is its own transactions row;
// admins never edit a past payment, they add a new one.

export async function fetchOrderPaymentHistory(orderId: string): Promise<OrderPaymentSummary> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('transactions')
    .select('id, transaction_date, amount, harga, discount, payment_method, description')
    .eq('order_id', orderId)
    .neq('status', 'rejected')

  return computeOrderPaymentSummary((data ?? []) as OrderPaymentRow[])
}

export async function addPaymentToOrder(
  orderId: string,
  amount: number,
  paymentMethod: string,
  keterangan?: string | null,
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

  const { data: existingRows, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, harga, discount, patient_id, branch_id, visit_id, fisio_id, category')
    .eq('order_id', orderId)
    .neq('status', 'rejected')
    .order('transaction_date', { ascending: true })
    .limit(1)

  if (fetchErr || !existingRows?.length) return { error: 'Order tidak ditemukan' }
  const template = existingRows[0]

  const { error } = await supabase.from('transactions').insert({
    order_id:         orderId,
    visit_id:         template.visit_id,
    patient_id:       template.patient_id,
    branch_id:        template.branch_id,
    fisio_id:         template.fisio_id,
    type:             'income',
    category:         template.category,
    harga:            template.harga,
    discount:         template.discount,
    amount,
    payment_method:   paymentMethod,
    description:      keterangan || null,
    transaction_date: new Date().toISOString().slice(0, 10),
    status:           'pending',
    recorded_by:      user.id,
    updated_at:       new Date().toISOString(),
  })

  if (error) return { error: error.message }

  await sendPaymentNotification(amount, template.category)
  return { error: null }
}

// ── Update an existing transaction ───────────────────────────────────────────

export interface UpdateTransactionInput {
  type?: string
  category?: string
  harga?: number
  discount?: number
  amount?: number
  payment_method?: string | null
  payment_status?: string | null
  penjamin?: string | null
  description?: string | null
  transaction_date?: string
  patient_id?: string | null
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
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
    return { error: 'Tidak memiliki akses' }
  }

  const { error } = await supabase
    .from('transactions')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)

  return { error: error?.message ?? null }
}

// ── Reclassify an income transaction as expense ───────────────────────────────

export async function reclassifyAsExpense(
  transactionId: string,
  category: string,
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
    return { error: 'Tidak memiliki akses' }
  }

  const { error } = await supabase
    .from('transactions')
    .update({
      type:           'expense',
      category,
      payment_status: null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', transactionId)

  return { error: error?.message ?? null }
}

// ── Create transaction manually (from finance/transactions page) ──────────────

export interface CreateTransactionManualInput {
  type: string
  category: string
  harga: number
  amount: number
  discount: number
  payment_method: string | null
  payment_status: string | null
  penjamin: string | null
  description: string | null
  transaction_date: string
  visit_id?: string | null
  patient_id?: string | null
  package_id?: string | null
  branch_id?: string | null
}

export async function createTransactionManual(
  input: CreateTransactionManualInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (!profile || !PAYMENT_ROLES.includes(profile.role)) {
    return { error: 'Tidak memiliki akses untuk mencatat transaksi' }
  }

  const branchId = input.branch_id ?? profile.branch_id
  if (!branchId) {
    return { error: 'Akun Anda belum terhubung ke cabang. Hubungi direktur.' }
  }

  // The order_id for a package purchase belongs to the package (so DP/Pelunasan
  // installments share one order), not the visit that may have prompted the sale.
  let orderId: string | null = null
  if (input.package_id) {
    const { data: pkg } = await supabase
      .from('patient_packages')
      .select('order_id')
      .eq('id', input.package_id)
      .single()
    orderId = pkg?.order_id ?? null
  } else if (input.visit_id) {
    const { data: visit } = await supabase
      .from('patient_visits')
      .select('order_id')
      .eq('id', input.visit_id)
      .single()
    orderId = visit?.order_id ?? null
  }

  const autoConfirm = input.type === 'income' && PACKAGE_CATEGORIES.has(input.category)

  const { error } = await supabase.from('transactions').insert({
    branch_id:        branchId,
    recorded_by:      user.id,
    type:             input.type,
    category:         input.category,
    order_id:         orderId,
    harga:            input.harga,
    amount:           input.amount,
    discount:         input.discount,
    payment_method:   input.payment_method,
    payment_status:   input.type === 'income' ? input.payment_status : null,
    penjamin:         input.type === 'income' ? (input.penjamin || null) : null,
    description:      input.description || null,
    transaction_date: input.transaction_date,
    visit_id:         input.visit_id ?? null,
    patient_id:       input.patient_id ?? null,
    status:           autoConfirm ? 'confirmed' : 'pending',
    confirmed_by:     autoConfirm ? user.id : null,
    updated_at:       new Date().toISOString(),
  })

  if (error) return { error: error.message }

  if (input.type === 'income') {
    await sendPaymentNotification(input.harga, input.category)
  }
  return { error: null }
}

// ── Delete a transaction ──────────────────────────────────────────────────────

export async function deleteTransaction(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !PAYMENT_ROLES.includes(profile.role)) {
    return { error: 'Tidak memiliki akses' }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id)

  return { error: error?.message ?? null }
}
