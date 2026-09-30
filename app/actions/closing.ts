'use server'

import { createClient } from '@/lib/supabase/server'
import { isRegioRequired } from '@/lib/visitRouting'

export interface PaymentMethodTotal {
  payment_method: string
  count: number
  total: number
}

export interface CategoryTotal {
  category: string
  count: number
  total: number
}

export interface ClosingTransactionItem {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  payment_method: string | null
  status: string
  description: string | null
  created_at: string
}

export interface ClosingFinancialRecap {
  incomeByMethod: PaymentMethodTotal[]
  incomeByCategory: CategoryTotal[]
  expenseByCategory: CategoryTotal[]
  totalIncome: number
  totalExpense: number
  cashToday: number
  transactions: ClosingTransactionItem[]
}

export async function fetchClosingFinancialRecap(
  branchId: string,
  dateFrom: string,
  dateTo: string = dateFrom,
): Promise<ClosingFinancialRecap> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('transactions')
    .select('id, type, category, payment_method, amount, status, description, created_at')
    .eq('branch_id', branchId)
    .gte('transaction_date', dateFrom)
    .lte('transaction_date', dateTo)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })

  const rows = data ?? []

  const incomeByMethodMap = new Map<string, PaymentMethodTotal>()
  const incomeByCategoryMap = new Map<string, CategoryTotal>()
  const expenseByCategoryMap = new Map<string, CategoryTotal>()
  let totalIncome = 0
  let totalExpense = 0
  let cashIncome = 0
  let cashExpense = 0

  for (const r of rows) {
    const amount = Number(r.amount ?? 0)
    if (r.type === 'income') {
      totalIncome += amount
      const method = r.payment_method ?? 'LAINNYA'
      const m = incomeByMethodMap.get(method) ?? { payment_method: method, count: 0, total: 0 }
      m.count += 1
      m.total += amount
      incomeByMethodMap.set(method, m)

      const category = r.category ?? 'LAINNYA'
      const c = incomeByCategoryMap.get(category) ?? { category, count: 0, total: 0 }
      c.count += 1
      c.total += amount
      incomeByCategoryMap.set(category, c)

      if (method === 'TUNAI') cashIncome += amount
    } else if (r.type === 'expense') {
      totalExpense += amount
      const category = r.category ?? 'LAINNYA'
      const c = expenseByCategoryMap.get(category) ?? { category, count: 0, total: 0 }
      c.count += 1
      c.total += amount
      expenseByCategoryMap.set(category, c)

      if ((r.payment_method ?? '') === 'TUNAI') cashExpense += amount
    }
  }

  return {
    incomeByMethod: [...incomeByMethodMap.values()],
    incomeByCategory: [...incomeByCategoryMap.values()],
    expenseByCategory: [...expenseByCategoryMap.values()],
    totalIncome,
    totalExpense,
    cashToday: cashIncome - cashExpense,
    transactions: rows.map((r) => ({
      id: r.id,
      type: r.type as 'income' | 'expense',
      category: r.category ?? 'LAINNYA',
      amount: Number(r.amount ?? 0),
      payment_method: r.payment_method,
      status: r.status,
      description: r.description,
      created_at: r.created_at,
    })),
  }
}

export interface IncompleteVisit {
  id: string
  patient_name: string
  service_type: string | null
  attending_staff_name: string | null
}

export interface VisitPayment {
  id: string
  category: string
  amount: number
  harga: number
  discount: number
  outstanding: number
  payment_method: string | null
  payment_status: string | null
  penjamin: string | null
  status: string
  description: string | null
}

export interface ClosingVisitItem {
  id: string
  visit_date: string
  patient_name: string
  service_type: string | null
  status: string
  attending_staff_name: string | null
  payments: VisitPayment[]
}

export interface ClosingVisitRecap {
  total: number
  byStatus: { status: string; count: number }[]
  incomplete: IncompleteVisit[]
  visits: ClosingVisitItem[]
}

export async function fetchClosingVisitRecap(
  branchId: string,
  dateFrom: string,
  dateTo: string = dateFrom,
): Promise<ClosingVisitRecap> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('patient_visits')
    .select('id, patient_id, visit_date, service_type, status, diagnosis, treatment, regio, attending_staff_id, internal_profiles!attending_staff_id(full_name)')
    .eq('branch_id', branchId)
    .gte('visit_date', dateFrom)
    .lte('visit_date', dateTo)
    .order('visit_date', { ascending: true })

  const rows = data ?? []

  const statusCounts = new Map<string, number>()
  for (const r of rows) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1)
  }

  const incompleteRows = rows.filter((v) =>
    v.status === 'completed' &&
    (!v.diagnosis || !v.treatment || (isRegioRequired(v.service_type) && !v.regio)) &&
    !!v.attending_staff_id,
  )

  const visitIds = rows.map((v) => v.id)
  const { data: txRows } = visitIds.length
    ? await supabase
      .from('transactions')
      .select('id, visit_id, category, amount, harga, discount, outstanding, payment_method, payment_status, penjamin, status, description')
      .in('visit_id', visitIds)
      .neq('status', 'rejected')
      .order('created_at', { ascending: true })
    : { data: [] }
  const paymentsByVisit = new Map<string, VisitPayment[]>()
  for (const t of txRows ?? []) {
    const list = paymentsByVisit.get(t.visit_id) ?? []
    list.push({
      id: t.id,
      category: t.category ?? 'LAINNYA',
      amount: Number(t.amount ?? 0),
      harga: Number(t.harga ?? 0),
      discount: Number(t.discount ?? 0),
      outstanding: Number(t.outstanding ?? 0),
      payment_method: t.payment_method,
      payment_status: t.payment_status,
      penjamin: t.penjamin,
      status: t.status,
      description: t.description,
    })
    paymentsByVisit.set(t.visit_id, list)
  }

  const patientIds = [...new Set(rows.map((v) => v.patient_id))]
  const { data: patients } = patientIds.length
    ? await supabase.from('patients').select('id, encrypted_name').in('id', patientIds)
    : { data: [] }
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

  const { decryptPatientPII } = await import('@/lib/encryption')
  const nameCache = new Map<string, string>()
  const patientName = (patientId: string) => {
    const cached = nameCache.get(patientId)
    if (cached) return cached
    const encName = nameById.get(patientId) ?? ''
    let name = '—'
    if (encName) {
      try {
        name = decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name || '—'
      } catch { /* keep default */ }
    }
    nameCache.set(patientId, name)
    return name
  }

  return {
    total: rows.length,
    byStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    incomplete: incompleteRows.map((v) => ({
      id: v.id,
      patient_name: patientName(v.patient_id),
      service_type: v.service_type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attending_staff_name: (v.internal_profiles as any)?.full_name ?? null,
    })),
    visits: rows.map((v) => ({
      id: v.id,
      visit_date: v.visit_date,
      patient_name: patientName(v.patient_id),
      service_type: v.service_type,
      status: v.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attending_staff_name: (v.internal_profiles as any)?.full_name ?? null,
      payments: paymentsByVisit.get(v.id) ?? [],
    })),
  }
}
