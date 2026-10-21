'use server'

// Audit Capaian: every visit and sale of a branch + window, valid or not, with
// the reasons it is left out of Target Progress / PFOTM / Payroll. Same rule
// (lib/metrics/achievement.ts) as those pages, so the "Valid" rows are exactly
// what they count. Director (any branch), manager (own branch), HR (any branch).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { kunjunganIssues } from '@/lib/metrics/achievement'
import { evaluateSales, SALE_TX_COLUMNS, withRecordStatus, type SaleTxRow } from '@/lib/metrics/achievementData'
import { resolvePatientNames } from '@/lib/metrics/patientNames'
import { effectiveServiceType } from '@/lib/payroll/autoActivity'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const AUDIT_ROLES = ['director', 'manager', 'hr']
/** Transaction categories behind the achievement numbers. */
const AUDIT_CATEGORIES = ['TA KLINIK', 'SESI KLINIK', 'PAKET KLINIK', 'TA VISIT', 'SESI VISIT', 'PAKET VISIT']

export interface AuditVisitRow {
  id: string
  date: string
  time: string | null
  patientName: string
  therapist: string
  layanan: string | null
  kehadiran: string | null
  issues: string[]
}

export interface AuditSaleRow {
  id: string
  date: string
  patientName: string
  therapist: string
  category: string
  harga: number
  discount: number
  amount: number
  paymentStatus: string | null
  paymentMethod: string | null
  hasProof: boolean
  issues: string[]
}

export interface AuditData {
  branches: { id: string; name: string }[]
  branchId: string
  visits: AuditVisitRow[]
  sales: AuditSaleRow[]
}

const todayJakarta = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

export async function getAchievementAudit(branchIdParam: string | null, start: string, end: string): Promise<Result<AuditData>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesi berakhir, silakan login ulang.' }
  const { data: profile } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile || !AUDIT_ROLES.includes(profile.role)) return { ok: false, error: 'Anda tidak memiliki akses.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return { ok: false, error: 'Rentang tanggal tidak valid.' }

  const admin = createAdminClient()
  const crossBranch = profile.role !== 'manager'
  let bq = admin.from('branches').select('id, name').eq('is_active', true).order('name')
  if (!crossBranch) bq = bq.eq('id', profile.branch_id ?? '')
  const { data: branches } = await bq
  const branchId = crossBranch ? (branchIdParam || branches?.[0]?.id || '') : (profile.branch_id ?? '')
  if (!branchId) return { ok: false, error: 'Akun Anda belum terhubung ke cabang.' }

  const [visitRes, txRes] = await Promise.all([
    admin.from('patient_visits')
      .select('id, patient_id, attending_staff_id, visit_date, visit_time, kehadiran, status, service_type, package_id, diagnosis, treatment, regio')
      .eq('branch_id', branchId).gte('visit_date', start).lte('visit_date', end)
      .order('visit_date').order('visit_time').limit(20000),
    admin.from('transactions').select(SALE_TX_COLUMNS)
      .eq('branch_id', branchId).eq('type', 'income').neq('status', 'rejected')
      .in('category', AUDIT_CATEGORIES)
      .gte('transaction_date', start).lte('transaction_date', end)
      .order('transaction_date').limit(20000),
  ])
  if (visitRes.error || txRes.error) return { ok: false, error: (visitRes.error ?? txRes.error)!.message }

  type V = {
    id: string; patient_id: string; attending_staff_id: string | null; visit_date: string; visit_time: string | null
    kehadiran: 'HADIR' | 'TIDAK HADIR' | null; status: string | null; service_type: string | null; package_id: string | null
    diagnosis: string | null; treatment: string | null; regio: string | null
  }
  const today = todayJakarta()
  const [visits, { sales }] = await Promise.all([
    withRecordStatus(admin, (visitRes.data ?? []) as V[]),
    evaluateSales(admin, (txRes.data ?? []) as unknown as SaleTxRow[]),
  ])

  const staffIds = [...new Set([
    ...visits.map((v) => v.attending_staff_id), ...sales.map((s) => s.tx.staff_id),
  ].filter((x): x is string => !!x))]
  const [names, { data: staff }] = await Promise.all([
    resolvePatientNames([...visits.map((v) => v.patient_id), ...sales.map((s) => s.tx.patient_id)]),
    staffIds.length
      ? admin.from('internal_profiles').select('id, full_name, nickname').in('id', staffIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; nickname: string | null }[] }),
  ])
  const staffName = new Map((staff ?? []).map((p) => [p.id as string, (p.nickname as string | null)?.trim() || (p.full_name as string)]))
  const nameOf = (id: string | null) => (id && names.get(id)) || '—'

  return {
    ok: true,
    data: {
      branches: branches ?? [],
      branchId,
      visits: visits.map((v) => ({
        id: v.id,
        date: v.visit_date,
        time: v.visit_time,
        patientName: nameOf(v.patient_id),
        therapist: (v.attending_staff_id && staffName.get(v.attending_staff_id)) || '—',
        layanan: effectiveServiceType(v),
        kehadiran: v.kehadiran,
        issues: kunjunganIssues(v, today),
      })),
      sales: sales.map(({ tx, issues }) => ({
        id: tx.id,
        date: tx.transaction_date,
        patientName: nameOf(tx.patient_id),
        therapist: (tx.staff_id && staffName.get(tx.staff_id)) || '—',
        category: tx.category,
        harga: Number(tx.harga ?? 0),
        discount: Number(tx.discount ?? 0),
        amount: Number(tx.amount ?? 0),
        paymentStatus: tx.payment_status,
        paymentMethod: tx.payment_method,
        hasProof: !!tx.receipt_url,
        issues,
      })),
    },
  }
}
