'use server'

// "Cek Data" — transactions and visits with missing details (no therapist, no
// patient, no payment status, transfer without proof, attendance / medical
// record not filled), plus fixing the therapist in bulk. Rules live in
// lib/finance/dataCheck.ts; the therapist rule is the finance one
// (lib/finance/therapists.ts), so a fix here shows up on finance, Progress
// Target and PFOTM alike.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activityLog'
import { resolvePatientNames } from '@/lib/metrics/patientNames'
import { KUNJUNGAN_VISIT_STATUSES, datesBetween } from '@/lib/metrics/achievement'
import { listTherapistOptions, resolveTherapistIds, type TherapistOption } from '@/lib/finance/therapists'
import { suggestLastTherapists, type TherapistSuggestion } from '@/lib/finance/suggestTherapist'
import { TX_ISSUES, VISIT_ISSUES, txIssues, visitIssues } from '@/lib/finance/dataCheck'
import { isGatewayPayment } from '@/lib/paymentProof'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }
type Result<T = null> = Ok<T> | Err
const ok = <T>(data: T): Ok<T> => ({ ok: true, data })
const fail = (error: string): Err => ({ ok: false, error })

const ROLES = ['finance', 'manager', 'director', 'admin']
const PAGE_SIZE = 10
const MAX_DAYS = 93
const ISO = /^\d{4}-\d{2}-\d{2}$/

type ServerClient = Awaited<ReturnType<typeof createClient>>

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail('Sesi berakhir, silakan login ulang.')
  const { data: profile } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile) return fail('Profil tidak ditemukan.')
  if (!ROLES.includes(profile.role)) return fail('Anda tidak memiliki akses.')
  return { supabase, userId: user.id, role: profile.role as string, branchId: profile.branch_id as string | null }
}
type Actor = Exclude<Awaited<ReturnType<typeof getActor>>, Err>
const isErr = (x: unknown): x is Err => typeof x === 'object' && x !== null && (x as Err).ok === false

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

// ── Types returned to the UI ────────────────────────────────────────────────

export type DataCheckTab = 'transaksi' | 'kunjungan'

export interface DataCheckParams {
  branchId: string | null
  from: string
  to: string
  tab: DataCheckTab
  /** '' = any issue */
  issue: string
  /** search: patient name, category / service, therapist name ('' = all) */
  q?: string
  page: number
}

export interface DataCheckRow {
  id: string
  date: string
  patientId: string | null
  patientName: string
  /** transaction category / visit service type */
  label: string | null
  amount: number | null
  paymentStatus: string | null
  paymentMethod: string | null
  /** visits only */
  kehadiran: string | null
  therapistName: string | null
  issues: string[]
  suggestion: TherapistSuggestion | null
  /** DOKU rows are settled by the gateway — therapist may still be set */
  gateway: boolean
}

export interface DataCheckData {
  role: string
  branches: { id: string; name: string }[]
  branchId: string
  counts: { transaksi: Record<string, number>; kunjungan: Record<string, number> }
  totals: { transaksi: number; kunjungan: number }
  rows: DataCheckRow[]
  total: number
  page: number
  pageSize: number
  therapists: TherapistOption[]
}

// ── Loading ─────────────────────────────────────────────────────────────────

interface TxRaw {
  id: string; transaction_date: string; category: string; patient_id: string | null; visit_id: string | null
  fisio_id: string | null; amount: number | null; payment_status: string | null; payment_method: string | null
  receipt_url: string | null
}
interface VisitRaw {
  id: string; patient_id: string; visit_date: string; service_type: string | null; attending_staff_id: string | null
  kehadiran: 'HADIR' | 'TIDAK HADIR' | null; status: string | null; diagnosis: string | null; treatment: string | null; regio: string | null
}
interface Flagged<T> { row: T; issues: string[]; therapistId: string | null }

async function resolveBranch(actor: Actor, requested: string | null) {
  let bq = actor.supabase.from('branches').select('id, name').eq('is_active', true).order('name')
  if (actor.role !== 'director') bq = bq.eq('id', actor.branchId ?? '')
  const { data: branches } = await bq
  const branchId = actor.role === 'director' ? (requested || branches?.[0]?.id || '') : (actor.branchId ?? '')
  return { branches: branches ?? [], branchId }
}

function checkRange(from: string, to: string): string | null {
  if (!ISO.test(from) || !ISO.test(to)) return 'Tanggal tidak valid.'
  if (to < from) return 'Tanggal akhir harus setelah tanggal mulai.'
  if (datesBetween(from, to).length > MAX_DAYS) return `Rentang maksimal ${MAX_DAYS} hari.`
  return null
}

async function flagTransactions(supabase: ServerClient, branchId: string, from: string, to: string): Promise<Flagged<TxRaw>[]> {
  const { data } = await supabase
    .from('transactions')
    .select('id, transaction_date, category, patient_id, visit_id, fisio_id, amount, payment_status, payment_method, receipt_url')
    .eq('branch_id', branchId).eq('type', 'income').neq('status', 'rejected')
    .gte('transaction_date', from).lte('transaction_date', to)
    .limit(10000)
  const rows = (data ?? []) as TxRaw[]
  const therapistByTx = await resolveTherapistIds(supabase, rows)
  return rows.map((row) => {
    const therapistId = therapistByTx.get(row.id) ?? null
    return { row, therapistId, issues: txIssues({ ...row, therapist_id: therapistId }) }
  })
}

async function flagVisits(branchId: string, from: string, to: string): Promise<Flagged<VisitRaw>[]> {
  // Service role after the branch check: finance can't always read visits / record forms under RLS.
  const admin = createAdminClient()
  const { data } = await admin
    .from('patient_visits')
    .select('id, patient_id, visit_date, service_type, attending_staff_id, kehadiran, status, diagnosis, treatment, regio')
    .eq('branch_id', branchId)
    .in('status', [...KUNJUNGAN_VISIT_STATUSES])
    .gte('visit_date', from).lte('visit_date', to)
    .limit(20000)
  const rows = (data ?? []) as VisitRaw[]

  // Record-form status per visit; 'completed' wins (same as Progress Target's detail list).
  const formStatus = new Map<string, string>()
  const ids = rows.map((r) => r.id)
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300)
    const results = await Promise.all(
      ['terapi_awal_assessments', 'session_notes', 'griya_terapi_awal', 'griya_session_notes']
        .map((t) => admin.from(t).select('visit_id, status').in('visit_id', chunk)),
    )
    for (const r of results.flatMap((x) => x.data ?? [])) {
      const vid = r.visit_id as string
      if (formStatus.get(vid) !== 'completed') formStatus.set(vid, r.status as string)
    }
  }
  const today = todayJakarta()
  return rows.map((row) => ({ row, therapistId: row.attending_staff_id, issues: visitIssues(row, formStatus.get(row.id), today) }))
}

function countIssues(flagged: Flagged<unknown>[], keys: string[]) {
  const counts: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const f of flagged) for (const i of f.issues) counts[i] = (counts[i] ?? 0) + 1
  return counts
}

const filterRows = <T>(flagged: Flagged<T>[], issue: string) =>
  flagged.filter((f) => (issue ? f.issues.includes(issue) : f.issues.length > 0))

/** Text search over patient name (decrypted), category / service and current therapist. */
async function searchRows<T extends TxRaw | VisitRaw>(flagged: Flagged<T>[], q: string | undefined): Promise<Flagged<T>[]> {
  const term = (q ?? '').trim().toLowerCase()
  if (!term) return flagged
  const staffIds = [...new Set(flagged.map((f) => f.therapistId).filter((x): x is string => !!x))]
  const [names, { data: staff }] = await Promise.all([
    resolvePatientNames(flagged.map((f) => f.row.patient_id)),
    staffIds.length
      ? createAdminClient().from('internal_profiles').select('id, full_name, nickname').in('id', staffIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; nickname: string | null }[] }),
  ])
  const staffText = new Map((staff ?? []).map((p) => [p.id, `${p.full_name} ${p.nickname ?? ''}`.toLowerCase()]))
  return flagged.filter((f) => {
    const label = 'category' in f.row ? f.row.category : f.row.service_type
    return [
      f.row.patient_id ? names.get(f.row.patient_id) : '',
      label,
      f.therapistId ? staffText.get(f.therapistId) : '',
    ].some((x) => (x ?? '').toLowerCase().includes(term))
  })
}

async function toRows(tab: DataCheckTab, branchId: string, flagged: Flagged<TxRaw | VisitRaw>[]): Promise<DataCheckRow[]> {
  const patientIds = flagged.map((f) => f.row.patient_id)
  const staffIds = [...new Set(flagged.map((f) => f.therapistId).filter((x): x is string => !!x))]
  const needSuggestion = flagged.filter((f) => f.issues.includes('tanpa_fisio'))
  const [names, { data: staff }, suggestions] = await Promise.all([
    resolvePatientNames(patientIds),
    staffIds.length
      ? createAdminClient().from('internal_profiles').select('id, full_name, nickname').in('id', staffIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; nickname: string | null }[] }),
    suggestLastTherapists(needSuggestion.map((f) => ({
      key: f.row.id,
      patient_id: f.row.patient_id,
      branch_id: branchId,
      date: 'transaction_date' in f.row ? f.row.transaction_date : f.row.visit_date,
      excludeVisitId: tab === 'kunjungan' ? f.row.id : undefined,
    }))),
  ])
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.nickname?.trim() || s.full_name]))

  return flagged.map(({ row, issues, therapistId }) => {
    const tx = 'transaction_date' in row ? row : null
    const visit = tx ? null : (row as VisitRaw)
    return {
      id: row.id,
      date: tx ? tx.transaction_date : visit!.visit_date,
      patientId: row.patient_id,
      patientName: (row.patient_id && names.get(row.patient_id)) || '—',
      label: tx ? tx.category : visit!.service_type,
      amount: tx ? Number(tx.amount ?? 0) : null,
      paymentStatus: tx?.payment_status ?? null,
      paymentMethod: tx?.payment_method ?? null,
      kehadiran: visit?.kehadiran ?? null,
      therapistName: therapistId ? (staffName.get(therapistId) ?? '—') : null,
      issues,
      suggestion: suggestions.get(row.id) ?? null,
      gateway: !!tx && isGatewayPayment(tx.payment_method),
    }
  })
}

const byDateDesc = (a: Flagged<TxRaw | VisitRaw>, b: Flagged<TxRaw | VisitRaw>) => {
  const da = 'transaction_date' in a.row ? a.row.transaction_date : a.row.visit_date
  const db = 'transaction_date' in b.row ? b.row.transaction_date : b.row.visit_date
  return db.localeCompare(da) || b.row.id.localeCompare(a.row.id)
}

export async function getDataCheck(params: DataCheckParams): Promise<Result<DataCheckData>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const rangeErr = checkRange(params.from, params.to)
  if (rangeErr) return fail(rangeErr)
  const { branches, branchId } = await resolveBranch(actor, params.branchId)
  if (!branchId) return fail('Akun Anda belum terhubung ke cabang.')

  const [txs, visits, therapists] = await Promise.all([
    flagTransactions(actor.supabase, branchId, params.from, params.to),
    flagVisits(branchId, params.from, params.to),
    listTherapistOptions(actor.supabase, branchId),
  ])
  const source = (params.tab === 'kunjungan' ? visits : txs) as Flagged<TxRaw | VisitRaw>[]
  const filtered = (await searchRows(filterRows(source, params.issue), params.q)).sort(byDateDesc)
  const page = Math.max(1, Math.min(params.page, Math.ceil(filtered.length / PAGE_SIZE) || 1))
  const rows = await toRows(params.tab, branchId, filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))

  return ok({
    role: actor.role,
    branches,
    branchId,
    counts: {
      transaksi: countIssues(txs, Object.keys(TX_ISSUES)),
      kunjungan: countIssues(visits, Object.keys(VISIT_ISSUES)),
    },
    totals: { transaksi: txs.filter((f) => f.issues.length).length, kunjungan: visits.filter((f) => f.issues.length).length },
    rows,
    total: filtered.length,
    page,
    pageSize: PAGE_SIZE,
    therapists,
  })
}

/** Every row of the current filter (for the Excel export). */
export async function exportDataCheck(params: Omit<DataCheckParams, 'page'>): Promise<Result<DataCheckRow[]>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const rangeErr = checkRange(params.from, params.to)
  if (rangeErr) return fail(rangeErr)
  const { branchId } = await resolveBranch(actor, params.branchId)
  if (!branchId) return fail('Akun Anda belum terhubung ke cabang.')
  const source = (params.tab === 'kunjungan'
    ? await flagVisits(branchId, params.from, params.to)
    : await flagTransactions(actor.supabase, branchId, params.from, params.to)) as Flagged<TxRaw | VisitRaw>[]
  return ok(await toRows(params.tab, branchId, (await searchRows(filterRows(source, params.issue), params.q)).sort(byDateDesc)))
}

// ── Fixing the therapist ────────────────────────────────────────────────────

async function checkStaff(staffId: string | null, branchId: string): Promise<string | null> {
  if (staffId === null) return null
  const { data } = await createAdminClient().from('internal_profiles').select('branch_id, is_active').eq('id', staffId).maybeSingle()
  if (!data) return 'Fisio tidak ditemukan.'
  if (data.is_active === false) return 'Fisio sudah tidak aktif.'
  if (data.branch_id !== branchId) return 'Fisio bukan dari cabang ini.'
  return null
}

async function writeTherapist(
  actor: Actor, tab: DataCheckTab, ids: string[], staffId: string | null,
): Promise<Result<number>> {
  if (!ids.length) return ok(0)
  if (ids.length > 1000) return fail('Terlalu banyak baris sekaligus.')
  const table = tab === 'kunjungan' ? 'patient_visits' : 'transactions'
  const column = tab === 'kunjungan' ? 'attending_staff_id' : 'fisio_id'

  // Read through the caller's client: RLS keeps non-directors to their branch.
  const { data: before, error: readErr } = await actor.supabase.from(table).select(`id, branch_id, ${column}`).in('id', ids)
  if (readErr) return fail(readErr.message)
  const rows = (before ?? []) as unknown as ({ id: string; branch_id: string } & Record<string, string | null>)[]
  if (rows.length !== ids.length) return fail('Sebagian data tidak ditemukan atau di luar cabang Anda.')
  const branchIds = [...new Set(rows.map((r) => r.branch_id))]
  if (branchIds.length !== 1) return fail('Semua baris harus dari cabang yang sama.')
  if (actor.role !== 'director' && branchIds[0] !== actor.branchId) return fail('Anda tidak memiliki akses.')
  const staffErr = await checkStaff(staffId, branchIds[0])
  if (staffErr) return fail(staffErr)

  const { data: updated, error } = await actor.supabase
    .from(table).update({ [column]: staffId, updated_at: new Date().toISOString() }).in('id', ids).select('id')
  if (error) return fail(error.message)
  if ((updated ?? []).length !== ids.length) return fail('Sebagian baris tidak dapat diubah (hak akses).')

  await Promise.all(rows.map((r) => logActivity({
    supabase: actor.supabase, userId: actor.userId, action: 'update',
    resourceType: tab === 'kunjungan' ? 'patient_visit' : 'transaction', resourceId: r.id,
    resourceLabel: `Cek Data · ${tab === 'kunjungan' ? 'Fisio kunjungan' : 'Fisio transaksi'}`, branchId: r.branch_id,
    oldValues: { [column]: r[column] ?? null }, newValues: { [column]: staffId },
  })))
  return ok(ids.length)
}

/** Set (or clear) the therapist on transactions (`fisio_id`) or visits (`attending_staff_id`). */
export async function setDataCheckTherapist(tab: DataCheckTab, ids: string[], staffId: string | null): Promise<Result<number>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  return writeTherapist(actor, tab, ids, staffId)
}

/**
 * Bulk fix: every "Tanpa Fisio" row of the filter gets its suggestion (the
 * patient's last therapist up to that date). Rows without one are skipped.
 */
export async function applyTherapistSuggestions(
  params: Omit<DataCheckParams, 'page' | 'issue'>,
): Promise<Result<{ applied: number; skipped: number }>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const rangeErr = checkRange(params.from, params.to)
  if (rangeErr) return fail(rangeErr)
  const { branchId } = await resolveBranch(actor, params.branchId)
  if (!branchId) return fail('Akun Anda belum terhubung ke cabang.')

  const source = (params.tab === 'kunjungan'
    ? await flagVisits(branchId, params.from, params.to)
    : await flagTransactions(actor.supabase, branchId, params.from, params.to)) as Flagged<TxRaw | VisitRaw>[]
  const missing = source.filter((f) => f.issues.includes('tanpa_fisio'))
  const suggestions = await suggestLastTherapists(missing.map((f) => ({
    key: f.row.id,
    patient_id: f.row.patient_id,
    branch_id: branchId,
    date: 'transaction_date' in f.row ? f.row.transaction_date : f.row.visit_date,
    excludeVisitId: params.tab === 'kunjungan' ? f.row.id : undefined,
  })))

  const byStaff = new Map<string, string[]>()
  for (const [id, s] of suggestions) (byStaff.get(s.staffId) ?? byStaff.set(s.staffId, []).get(s.staffId)!).push(id)
  let applied = 0
  for (const [staffId, ids] of byStaff) {
    const res = await writeTherapist(actor, params.tab, ids, staffId)
    if (!res.ok) return fail(`${applied} baris tersimpan, lalu gagal: ${res.error}`)
    applied += res.data
  }
  return ok({ applied, skipped: missing.length - applied })
}

// ── Package purchase form ───────────────────────────────────────────────────

/**
 * Fisio options for a new sale plus the default: the patient's last therapist
 * up to today — so a package bought at the cashier is credited from the start.
 */
export async function getSaleFisioDefaults(
  patientId: string, branchId: string | null,
): Promise<Result<{ therapists: TherapistOption[]; suggestion: TherapistSuggestion | null }>> {
  const actor = await getActor()
  if (isErr(actor)) return actor
  const branch = actor.role === 'director' ? (branchId ?? '') : (actor.branchId ?? '')
  if (!branch) return ok({ therapists: [], suggestion: null })
  const [therapists, suggestions] = await Promise.all([
    listTherapistOptions(actor.supabase, branch),
    suggestLastTherapists([{ key: 'x', patient_id: patientId, branch_id: branch, date: todayJakarta() }]),
  ])
  return ok({ therapists: therapists.filter((t) => !t.inactive), suggestion: suggestions.get('x') ?? null })
}

