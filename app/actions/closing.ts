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

export interface ClosingFinancialRecap {
  incomeByMethod: PaymentMethodTotal[]
  incomeByCategory: CategoryTotal[]
  expenseByCategory: CategoryTotal[]
  totalIncome: number
  totalExpense: number
  cashToday: number
}

export async function fetchClosingFinancialRecap(
  branchId: string,
  date: string,
): Promise<ClosingFinancialRecap> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('transactions')
    .select('type, category, payment_method, amount')
    .eq('branch_id', branchId)
    .eq('transaction_date', date)
    .neq('status', 'rejected')

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
  }
}

export interface IncompleteVisit {
  id: string
  patient_name: string
  service_type: string | null
  attending_staff_name: string | null
}

export interface ClosingVisitRecap {
  total: number
  byStatus: { status: string; count: number }[]
  incomplete: IncompleteVisit[]
}

export async function fetchClosingVisitRecap(
  branchId: string,
  date: string,
): Promise<ClosingVisitRecap> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('patient_visits')
    .select('id, patient_id, service_type, status, diagnosis, treatment, regio, attending_staff_id, internal_profiles!attending_staff_id(full_name)')
    .eq('branch_id', branchId)
    .eq('visit_date', date)

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

  const patientIds = [...new Set(incompleteRows.map((v) => v.patient_id))]
  const { data: patients } = patientIds.length
    ? await supabase.from('patients').select('id, encrypted_name').in('id', patientIds)
    : { data: [] }
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.encrypted_name]))

  const { decryptPatientPII } = await import('@/lib/encryption')

  return {
    total: rows.length,
    byStatus: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    incomplete: incompleteRows.map((v) => {
      const encName = nameById.get(v.patient_id) ?? ''
      let name = '—'
      if (encName) {
        try {
          name = decryptPatientPII({ encrypted_name: encName, encrypted_phone: '' }).name || '—'
        } catch { /* keep default */ }
      }
      return {
        id: v.id,
        patient_name: name,
        service_type: v.service_type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attending_staff_name: (v.internal_profiles as any)?.full_name ?? null,
      }
    }),
  }
}
