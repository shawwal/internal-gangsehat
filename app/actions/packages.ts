'use server'

import { createClient } from '@/lib/supabase/server'
import type { PatientPackage, PackageSession } from '@/types'
import { generateOrderId } from '@/lib/internal/orderId'

// ── Fetch all packages for a patient with computed session counts ───────────────
// Reads from the patient_packages_with_stats view which joins patient_visits.
export async function fetchPatientPackages(
  patientId: string,
): Promise<PatientPackage[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_packages_with_stats')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error || !data?.length) return []

  return data.map((p) => ({
    id:                 p.id,
    patient_id:         p.patient_id,
    branch_id:          p.branch_id ?? null,
    package_name:       p.package_name,
    package_type:       p.package_type as PatientPackage['package_type'],
    total_sessions:     p.total_sessions,
    used_sessions:      Number(p.used_sessions ?? 0),
    remaining_sessions: Number(p.remaining_sessions ?? p.total_sessions),
    notes:              p.notes ?? null,
    status:             p.status as PatientPackage['status'],
    jenis_paket:        (p.jenis_paket ?? null) as PatientPackage['jenis_paket'],
    mulai_paket:        (p.mulai_paket ?? null) as PatientPackage['mulai_paket'],
    operational_status: (p.operational_status ?? 'ON') as PatientPackage['operational_status'],
    completion_status:  (p.completion_status ?? null) as PatientPackage['completion_status'],
    category:           (p.category ?? null) as PatientPackage['category'],
    order_id:           p.order_id ?? null,
    purchased_at:       p.purchased_at,
    created_at:         p.created_at,
    updated_at:         p.updated_at,
  }))
}

// ── Fetch packages with their payment info ──────────────────────────────────────
// Packages have no FK to transactions. Payment can be linked two ways:
//  1. order_id — the newer path (createTransactionManual with package_id), where
//     the transaction shares the package's own order_id.
//  2. visit_id → patient_visits.package_id — how the vast majority of existing
//     packages are actually linked: the transaction is tied to the visit that
//     prompted the sale, and that visit's package_id points back at the package.
// Both paths are checked and merged — relying on order_id alone misses nearly
// every historical package sale and would wrongly show them as unpaid.
export interface PackagePayment {
  harga: number | null
  amountPaid: number
  outstanding: number
  paymentStatus: 'LUNAS' | 'DP'
  transactionStatus: 'pending' | 'confirmed'
}

export type PatientPackageWithPayment = PatientPackage & { payment: PackagePayment | null }

interface PkgTxRow { harga: number; amount: number; discount: number; status: string }

export async function fetchPatientPackagesWithPayment(
  patientId: string,
): Promise<PatientPackageWithPayment[]> {
  const packages = await fetchPatientPackages(patientId)
  if (packages.length === 0) return []

  const supabase = await createClient()
  const packageIds = packages.map((p) => p.id)
  const orderIds   = packages.map((p) => p.order_id).filter((v): v is string => !!v)

  const [orderTxRes, linkedVisitsRes] = await Promise.all([
    orderIds.length > 0
      ? supabase.from('transactions')
          .select('order_id, harga, amount, discount, status')
          .in('order_id', orderIds)
          .in('category', ['PAKET KLINIK', 'PAKET VISIT'])
          .neq('status', 'rejected')
      : Promise.resolve({ data: [] }),
    supabase.from('patient_visits').select('id, package_id').in('package_id', packageIds),
  ])

  const orderToPackage = new Map(packages.filter((p) => p.order_id).map((p) => [p.order_id as string, p.id]))
  const visitToPackage = new Map(
    (linkedVisitsRes.data ?? []).filter((v) => v.package_id).map((v) => [v.id, v.package_id as string]),
  )
  const visitIds = [...visitToPackage.keys()]

  const visitTxRes = visitIds.length > 0
    ? await supabase.from('transactions')
        .select('visit_id, harga, amount, discount, status')
        .in('visit_id', visitIds)
        .in('category', ['PAKET KLINIK', 'PAKET VISIT'])
        .neq('status', 'rejected')
    : { data: [] }

  const byPackage = new Map<string, PkgTxRow[]>()
  function addRow(pkgId: string | undefined, row: PkgTxRow) {
    if (!pkgId) return
    const list = byPackage.get(pkgId) ?? []
    list.push(row)
    byPackage.set(pkgId, list)
  }
  for (const t of (orderTxRes.data ?? []) as { order_id: string; harga: number; amount: number; discount: number; status: string }[]) {
    addRow(orderToPackage.get(t.order_id), t)
  }
  for (const t of (visitTxRes.data ?? []) as { visit_id: string; harga: number; amount: number; discount: number; status: string }[]) {
    addRow(visitToPackage.get(t.visit_id), t)
  }

  return packages.map((p) => {
    const rows = byPackage.get(p.id)
    if (!rows || rows.length === 0) return { ...p, payment: null }

    const harga         = rows[0].harga
    const amountPaid     = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
    const discountTotal  = rows.reduce((s, r) => s + (r.discount ?? 0), 0)
    const outstanding    = Math.max(harga - amountPaid - discountTotal, 0)

    return {
      ...p,
      payment: {
        harga,
        amountPaid,
        outstanding,
        paymentStatus:     outstanding === 0 ? 'LUNAS' : 'DP',
        transactionStatus: rows.some((r) => r.status === 'pending') ? 'pending' : 'confirmed',
      },
    }
  })
}

// ── Fetch all visits linked to a specific package ──────────────────────────────
export async function fetchPackageSessions(
  packageId: string,
): Promise<PackageSession[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_visits')
    .select('id, visit_date, service_type, shift, kehadiran, status, internal_profiles!attending_staff_id(full_name)')
    .eq('package_id', packageId)
    .neq('status', 'cancelled')
    .order('visit_date', { ascending: true })

  if (error || !data?.length) return []

  return data.map((v) => ({
    id:             v.id,
    visit_date:     v.visit_date,
    service_type:   v.service_type,
    shift:          v.shift as PackageSession['shift'],
    kehadiran:      v.kehadiran as PackageSession['kehadiran'],
    status:         v.status,
    therapist_name: (v.internal_profiles as unknown as { full_name: string } | null)?.full_name ?? null,
  }))
}

// ── Create a new patient package ───────────────────────────────────────────────
// total_sessions is derived from jenis_paket (P1→5, P2→10) when provided.
export async function createPatientPackage(input: {
  patient_id: string
  branch_id: string | null
  package_name: string
  jenis_paket: 'P1' | 'P2'
  mulai_paket: 'NEW' | 'EXT.'
  category: 'PAKET KLINIK' | 'PAKET VISIT'
  notes?: string | null
}): Promise<{ id: string | null; order_id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const total_sessions = input.jenis_paket === 'P1' ? 5 : 10
  const orderId = await generateOrderId(supabase)

  const { data, error } = await supabase
    .from('patient_packages')
    .insert({
      patient_id:     input.patient_id,
      branch_id:      input.branch_id,
      package_name:   input.package_name,
      package_type:   'fixed',
      total_sessions,
      jenis_paket:    input.jenis_paket,
      mulai_paket:    input.mulai_paket,
      category:       input.category,
      order_id:       orderId,
      purchased_at:   new Date().toISOString().slice(0, 10),
      notes:          input.notes ?? null,
      created_by:     user?.id ?? null,
      updated_at:     new Date().toISOString(),
    })
    .select('id')
    .single()

  return { id: data?.id ?? null, order_id: error ? null : orderId, error: error?.message ?? null }
}

// ── Create a new patient package from the branch's service catalog ─────────────
// package_name/total_sessions come from internal_layanan (see app/actions/layanan.ts).
// jenis_paket is only set when jumlah_sesi matches the P1/P2 convention (5/10) —
// nothing downstream requires it, so other session counts just leave it null.
export async function createPackageFromLayanan(input: {
  patient_id: string
  branch_id: string | null
  layanan_id: string
  category: 'PAKET KLINIK' | 'PAKET VISIT'
}): Promise<{ id: string | null; order_id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: layanan, error: layananErr } = await supabase
    .from('internal_layanan')
    .select('nama, jumlah_sesi')
    .eq('id', input.layanan_id)
    .single()

  if (layananErr || !layanan) {
    return { id: null, order_id: null, error: layananErr?.message ?? 'Layanan tidak ditemukan.' }
  }

  const total_sessions = layanan.jumlah_sesi || 1
  const jenis_paket = total_sessions === 5 ? 'P1' : total_sessions === 10 ? 'P2' : null
  const orderId = await generateOrderId(supabase)

  const { data, error } = await supabase
    .from('patient_packages')
    .insert({
      patient_id:     input.patient_id,
      branch_id:      input.branch_id,
      package_name:   layanan.nama,
      package_type:   'fixed',
      total_sessions,
      jenis_paket,
      mulai_paket:    'NEW',
      category:       input.category,
      order_id:       orderId,
      purchased_at:   new Date().toISOString().slice(0, 10),
      created_by:     user?.id ?? null,
      updated_at:     new Date().toISOString(),
    })
    .select('id')
    .single()

  return { id: data?.id ?? null, order_id: error ? null : orderId, error: error?.message ?? null }
}

// ── Update an existing package ─────────────────────────────────────────────────
export async function updatePatientPackage(
  id: string,
  patch: {
    package_name?: string
    jenis_paket?: 'P1' | 'P2'
    mulai_paket?: 'NEW' | 'EXT.'
    category?: 'PAKET KLINIK' | 'PAKET VISIT'
    operational_status?: 'ON' | 'OFF' | 'PENDING'
    completion_status?: 'LANJUT' | 'SEMBUH' | 'TIDAK LANJUT' | 'STOP' | null
    status?: 'active' | 'completed' | 'cancelled'
    notes?: string | null
  },
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const update: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }

  // Sync total_sessions when jenis_paket changes
  if (patch.jenis_paket) {
    update.total_sessions = patch.jenis_paket === 'P1' ? 5 : 10
  }

  const { error } = await supabase
    .from('patient_packages')
    .update(update)
    .eq('id', id)

  return { error: error?.message ?? null }
}

// ── Delete a package ───────────────────────────────────────────────────────────
// Hard-deletes when it's safe to do so (no payment recorded, no linked visit
// sessions) — otherwise falls back to the previous soft-cancel behavior so
// packages with real history are never destroyed.
const PAYMENT_ROLES = ['finance', 'manager', 'director', 'admin']

export async function deletePatientPackage(
  id: string,
): Promise<{ error: string | null; hardDeleted: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi', hardDeleted: false }

  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !PAYMENT_ROLES.includes(profile.role)) {
    return { error: 'Tidak memiliki akses untuk menghapus paket', hardDeleted: false }
  }

  const { data: pkg } = await supabase
    .from('patient_packages')
    .select('order_id')
    .eq('id', id)
    .single()

  let hasPayment = false
  if (pkg?.order_id) {
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', pkg.order_id)
      .neq('status', 'rejected')
    hasPayment = (count ?? 0) > 0
  }

  if (!hasPayment) {
    const { error: delErr } = await supabase.from('patient_packages').delete().eq('id', id)
    if (!delErr) return { error: null, hardDeleted: true }
    // 23503 = FK violation — patient_visits.package_id still references this
    // package (it has recorded sessions); fall through to soft-cancel below.
    if (delErr.code !== '23503') return { error: delErr.message, hardDeleted: false }
  }

  const { error } = await supabase
    .from('patient_packages')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)

  return { error: error?.message ?? null, hardDeleted: false }
}
