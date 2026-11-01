'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRegioRequired } from '@/lib/visitRouting'
import { getEffectivePackageServiceType } from '@/lib/serviceType'
import { logActivity } from '@/lib/activityLog'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const CLOSING_ROLES = ['admin', 'finance', 'manager', 'director']
/** Salary expenses are visible to these roles only — hidden from admin / manager. */
const SALARY_ROLES = ['director', 'finance']
const SALARY_CATEGORY = 'GAJI'

/** Caller's role + branch, or null when they may not see this branch's closing. */
async function closingViewer(supabase: ServerClient, branchId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!me || !CLOSING_ROLES.includes(me.role)) return null
  if (me.role !== 'director' && me.branch_id !== branchId) return null
  return { userId: user.id, role: me.role as string }
}

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
  payment_status: string | null
  patient_name: string | null
  status: string
  description: string | null
  created_at: string
  receipt_url: string | null
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
  const viewer = await closingViewer(supabase, branchId)

  let query = supabase
    .from('transactions')
    .select('id, type, category, payment_method, payment_status, patient_id, amount, status, description, created_at, receipt_url')
    .eq('branch_id', branchId)
    .gte('transaction_date', dateFrom)
    .lte('transaction_date', dateTo)
    .neq('status', 'rejected')
  // Salaries stay out of every figure for roles that may not see them.
  if (!viewer || !SALARY_ROLES.includes(viewer.role)) {
    query = query.or(`type.neq.expense,category.neq.${SALARY_CATEGORY}`)
  }
  const { data } = await query.order('created_at', { ascending: false })

  const rows = data ?? []

  const txPatientIds = [...new Set(rows.map((r) => r.patient_id).filter(Boolean))] as string[]
  const { data: txPatients } = txPatientIds.length
    ? await supabase.from('patients').select('id, encrypted_name').in('id', txPatientIds)
    : { data: [] }
  const { decryptPatientPII } = await import('@/lib/encryption')
  const txNameById = new Map<string, string>()
  for (const p of txPatients ?? []) {
    try {
      txNameById.set(p.id, decryptPatientPII({ encrypted_name: p.encrypted_name, encrypted_phone: '' }).name || '—')
    } catch { /* skip */ }
  }

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
      payment_status: r.payment_status,
      patient_name: r.patient_id ? txNameById.get(r.patient_id) ?? null : null,
      status: r.status,
      description: r.description,
      created_at: r.created_at,
      receipt_url: r.receipt_url,
    })),
  }
}

export interface IncompleteByTherapist {
  staff_id: string
  name: string
  count: number
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
  receipt_url: string | null
}

export interface ClosingVisitItem {
  id: string
  visit_date: string
  patient_name: string
  service_type: string | null
  status: string
  kehadiran: string | null
  attending_staff_name: string | null
  payments: VisitPayment[]
}

export interface ClosingUnitStats {
  /** Sessions marked Hadir (not cancelled) */
  hadir: number
  paket: number
  sesi: number
  terapiAwal: number
  /** Still "Terjadwal" on Jadwal Harian */
  booking: number
  /** "Tdk Hadir" visits + bookings deleted from the schedule */
  tidakHadir: number
  deleted: number
  /** "Belum Lengkap" on Rekam Medis */
  incomplete: number
}

export interface ClosingUnitRecap {
  stats: ClosingUnitStats
  incompleteByTherapist: IncompleteByTherapist[]
  visits: ClosingVisitItem[]
}

export interface ClosingVisitRecap {
  fisioterapi: ClosingUnitRecap
  sportMassage: ClosingUnitRecap
}

/** Fisioterapi Klinik = the Jadwal Harian grid's service types; Sport Massage its own. */
const CLOSING_UNITS = {
  fisioterapi:  ['TERAPI AWAL KLINIK', 'PAKET KLINIK', 'SESI KLINIK', 'LAINNYA'],
  sportMassage: ['SPORT MASSAGE'],
} as const

const EMPTY_UNIT: ClosingUnitRecap = {
  stats: { hadir: 0, paket: 0, sesi: 0, terapiAwal: 0, booking: 0, tidakHadir: 0, deleted: 0, incomplete: 0 },
  incompleteByTherapist: [],
  visits: [],
}

export async function fetchClosingVisitRecap(
  branchId: string,
  dateFrom: string,
  dateTo: string = dateFrom,
): Promise<ClosingVisitRecap> {
  const supabase = await createClient()
  const viewer = await closingViewer(supabase, branchId)
  if (!viewer) return { fisioterapi: EMPTY_UNIT, sportMassage: EMPTY_UNIT }

  const allTypes: string[] = [...CLOSING_UNITS.fisioterapi, ...CLOSING_UNITS.sportMassage]
  const { data } = await supabase
    .from('patient_visits')
    .select('id, patient_id, visit_date, service_type, package_id, status, kehadiran, diagnosis, treatment, regio, attending_staff_id, internal_profiles!attending_staff_id(full_name)')
    .eq('branch_id', branchId)
    .in('service_type', allTypes)
    .gte('visit_date', dateFrom)
    .lte('visit_date', dateTo)
    .order('visit_date', { ascending: true })

  const rows = data ?? []

  // Bookings deleted from the schedule count as "Tidak Hadir". Deletions only
  // live in activity_logs, which RLS keeps director/manager-only — read with
  // the service role after the branch check above.
  const { data: deletedLogs } = await createAdminClient()
    .from('activity_logs')
    .select('old_values')
    .eq('resource_type', 'patient_visit')
    .eq('action', 'delete')
    .eq('branch_id', branchId)
    .gte('old_values->>visit_date', dateFrom)
    .lte('old_values->>visit_date', dateTo)
  const deletedByType = new Map<string, number>()
  for (const l of deletedLogs ?? []) {
    const st = (l.old_values as { service_type?: string } | null)?.service_type ?? ''
    deletedByType.set(st, (deletedByType.get(st) ?? 0) + 1)
  }

  const visitIds = rows.map((v) => v.id)
  const { data: txRows } = visitIds.length
    ? await supabase
      .from('transactions')
      .select('id, visit_id, category, amount, harga, discount, outstanding, payment_method, payment_status, penjamin, status, description, receipt_url')
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
      receipt_url: t.receipt_url,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffName = (v: (typeof rows)[number]) => ((v.internal_profiles as any)?.full_name ?? null) as string | null

  function unitRecap(types: readonly string[]): ClosingUnitRecap {
    const list = rows.filter((v) => types.includes(v.service_type ?? ''))
    const stats: ClosingUnitStats = { ...EMPTY_UNIT.stats }
    const byTherapist = new Map<string, IncompleteByTherapist>()

    for (const v of list) {
      const cancelled = v.status === 'cancelled'
      if (v.kehadiran === 'HADIR' && !cancelled) {
        stats.hadir++
        const st = getEffectivePackageServiceType(v.service_type, v.package_id)
        if (st === 'SPORT MASSAGE') {
          if (v.package_id) stats.paket++
          else stats.sesi++
        } else if (st === 'PAKET KLINIK') stats.paket++
        else if (st === 'SESI KLINIK') stats.sesi++
        else if (st === 'TERAPI AWAL KLINIK') stats.terapiAwal++
      }
      if (v.status === 'scheduled' && v.kehadiran !== 'TIDAK HADIR') stats.booking++
      if (!cancelled && (v.status === 'no_show' || v.kehadiran === 'TIDAK HADIR')) stats.tidakHadir++

      // Same rule as Rekam Medis "Belum Lengkap" (app/actions/medicalRecords.ts)
      const incomplete = v.status === 'completed' && !!v.attending_staff_id
        && (!v.diagnosis || !v.treatment || (isRegioRequired(v.service_type) && !v.regio))
      if (incomplete) {
        stats.incomplete++
        const agg = byTherapist.get(v.attending_staff_id!) ?? { staff_id: v.attending_staff_id!, name: staffName(v) ?? '—', count: 0 }
        agg.count++
        byTherapist.set(v.attending_staff_id!, agg)
      }
    }
    stats.deleted = types.reduce((n, t) => n + (deletedByType.get(t) ?? 0), 0)
    stats.tidakHadir += stats.deleted

    return {
      stats,
      incompleteByTherapist: [...byTherapist.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      visits: list.map((v) => ({
        id: v.id,
        visit_date: v.visit_date,
        patient_name: patientName(v.patient_id),
        service_type: v.service_type,
        status: v.status,
        kehadiran: v.kehadiran,
        attending_staff_name: staffName(v),
        payments: paymentsByVisit.get(v.id) ?? [],
      })),
    }
  }

  return {
    fisioterapi: unitRecap(CLOSING_UNITS.fisioterapi),
    sportMassage: unitRecap(CLOSING_UNITS.sportMassage),
  }
}

// ── Submit → Finance approval (migration 125) ──────────────────────────────────

export type ClosingSubmissionStatus = 'submitted' | 'approved' | 'rejected'

export interface ClosingSubmission {
  id: string
  status: ClosingSubmissionStatus
  submitted_at: string
  submitted_by_name: string | null
  reviewed_at: string | null
  reviewed_by_name: string | null
  review_note: string | null
}

export interface ClosingSnapshot {
  totalIncome: number
  totalExpense: number
  cashToday: number
  visitsHadir: number
}

export async function fetchClosingSubmission(branchId: string, date: string): Promise<ClosingSubmission | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('closing_submissions')
    .select('id, status, submitted_at, reviewed_at, review_note, submitter:internal_profiles!submitted_by(full_name), reviewer:internal_profiles!reviewed_by(full_name)')
    .eq('branch_id', branchId)
    .eq('closing_date', date)
    .maybeSingle()
  if (!data) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  return {
    id: d.id,
    status: d.status,
    submitted_at: d.submitted_at,
    submitted_by_name: d.submitter?.full_name ?? null,
    reviewed_at: d.reviewed_at,
    reviewed_by_name: d.reviewer?.full_name ?? null,
    review_note: d.review_note,
  }
}

async function notifyClosing(rows: { user_id?: string; target_role?: string; title: string; message: string; link: string }[]) {
  try {
    await createAdminClient().from('user_notifications').insert(rows)
  } catch (err) {
    console.error('[closing] notification failed', err)
  }
}

function closingDateLabel(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Admin / manager / director send the day to Finance. Resubmitting a rejected day is allowed. */
export async function submitClosing(
  branchId: string,
  date: string,
  snapshot: ClosingSnapshot,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const viewer = await closingViewer(supabase, branchId)
  if (!viewer || viewer.role === 'finance') return { error: 'Anda tidak dapat mengajukan closing ini.' }

  const existing = await fetchClosingSubmission(branchId, date)
  if (existing?.status === 'approved') return { error: 'Closing tanggal ini sudah disetujui Finance.' }

  const { data: row, error } = await supabase
    .from('closing_submissions')
    .upsert({
      branch_id: branchId,
      closing_date: date,
      status: 'submitted',
      snapshot,
      submitted_by: viewer.userId,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'branch_id,closing_date' })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const { data: branch } = await supabase.from('branches').select('name').eq('id', branchId).maybeSingle()
  await logActivity({
    supabase, userId: viewer.userId, action: existing ? 'update' : 'create', resourceType: 'closing_submission',
    resourceId: row?.id, resourceLabel: `Closing ${closingDateLabel(date)}`, branchId,
    newValues: { status: 'submitted', ...snapshot },
  })
  // Finance is branch-scoped: notify the branch's finance staff directly.
  const { data: financeStaff } = await createAdminClient()
    .from('internal_profiles').select('id').eq('role', 'finance').eq('branch_id', branchId).eq('is_active', true)
  await notifyClosing((financeStaff ?? []).map((f) => ({
    user_id: f.id,
    title: 'Closing Admin Diajukan',
    message: `${branch?.name ?? 'Cabang'} · ${closingDateLabel(date)} menunggu persetujuan Anda`,
    link: `/closing?date=${date}`,
  })))
  return { error: null }
}

/** Finance (or director) approves — the day's data is final — or rejects with a note. */
export async function reviewClosing(
  branchId: string,
  date: string,
  approve: boolean,
  note?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const viewer = await closingViewer(supabase, branchId)
  if (!viewer || !['finance', 'director'].includes(viewer.role)) return { error: 'Hanya Finance yang dapat menyetujui closing.' }
  if (!approve && !note?.trim()) return { error: 'Tulis alasan penolakan.' }

  const existing = await fetchClosingSubmission(branchId, date)
  if (!existing) return { error: 'Closing tanggal ini belum diajukan.' }

  const { error } = await supabase
    .from('closing_submissions')
    .update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: viewer.userId,
      reviewed_at: new Date().toISOString(),
      review_note: approve ? null : note!.trim(),
    })
    .eq('id', existing.id)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId: viewer.userId, action: 'update', resourceType: 'closing_submission',
    resourceId: existing.id, resourceLabel: `Closing ${closingDateLabel(date)}`, branchId,
    oldValues: { status: existing.status }, newValues: { status: approve ? 'approved' : 'rejected', review_note: note ?? null },
  })
  const { data: sub } = await supabase.from('closing_submissions').select('submitted_by').eq('id', existing.id).single()
  if (sub?.submitted_by) {
    await notifyClosing([{
      user_id: sub.submitted_by,
      title: approve ? 'Closing Disetujui Finance' : 'Closing Ditolak Finance',
      message: approve
        ? `Closing ${closingDateLabel(date)} sudah disetujui — data hari itu final.`
        : `Closing ${closingDateLabel(date)} perlu diperbaiki: ${note!.trim()}`,
      link: `/closing?date=${date}`,
    }])
  }
  return { error: null }
}
