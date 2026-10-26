'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII } from '@/lib/encryption'
import { fetchAllRows, fetchInChunks } from '@/lib/supabase/fetchAll'

/** Longest range one export may cover. */
const MAX_RANGE_DAYS = 366

export interface SportMassageExportRow {
  id: string
  patient_id: string
  therapist_id: string | null
  /** Tarif Layanan row: the booked one, or for a package visit the branch's Layanan matching the package */
  layanan_id: string | null
  visit_date: string
  visit_time: string | null
  order_id: string | null
  no_rm: string | null
  patient_name: string
  patient_phone: string
  therapist_name: string | null
  layanan: string | null
  kategori: string | null
  chief_complaint: string | null
  status: string
  kehadiran: string | null
  booking_source: string | null
  harga: number
  discount: number
  dibayar: number
  kurang_bayar: number
  payment_method: string | null
  payment_status: string | null
  notes: string | null
}

/** Every SPORT MASSAGE visit of the branch between dateFrom and dateTo (inclusive). */
export async function fetchSportMassageExportRows(
  dateFrom: string,
  dateTo: string,
  branchId?: string | null,
): Promise<SportMassageExportRow[]> {
  if (dateTo < dateFrom) [dateFrom, dateTo] = [dateTo, dateFrom]
  const days = (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000 + 1
  if (days > MAX_RANGE_DAYS) throw new Error(`Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari`)

  const supabase = await createClient()

  const visits = await fetchAllRows((f, t) => {
    let query = supabase
      .from('patient_visits')
      .select(`
        id, patient_id, branch_id, attending_staff_id, visit_date, visit_time, order_id, layanan_id, package_id, chief_complaint,
        status, kehadiran, booking_source, notes,
        internal_profiles!attending_staff_id(full_name, nickname)
      `)
      .eq('service_type', 'SPORT MASSAGE')
      .gte('visit_date', dateFrom)
      .lte('visit_date', dateTo)
    if (branchId) query = query.eq('branch_id', branchId)
    return query.order('visit_date').order('visit_time').order('id').range(f, t)
  })
  if (visits.length === 0) return []

  const patientIds = [...new Set(visits.map((v) => v.patient_id as string))]
  const visitIds = visits.map((v) => v.id as string)
  const branchIds = [...new Set(visits.map((v) => v.branch_id as string))]
  const packageIds = [...new Set(visits.map((v) => v.package_id).filter((id): id is string => !!id))]

  const [patients, txns, layanan, packages] = await Promise.all([
    fetchInChunks<{ id: string; no_rm: string | null; encrypted_name: string | null; encrypted_phone: string | null }>(
      patientIds,
      (c) => supabase.from('patients').select('id, no_rm, encrypted_name, encrypted_phone').in('id', c),
    ),
    fetchInChunks<{
      visit_id: string; type: string; amount: number | null; harga: number | null; discount: number | null
      outstanding: number | null; payment_method: string | null; payment_status: string | null; transaction_date: string | null
    }>(
      visitIds,
      (c) => supabase.from('transactions')
        .select('visit_id, type, amount, harga, discount, outstanding, payment_method, payment_status, transaction_date')
        .in('visit_id', c)
        .eq('type', 'income')
        .neq('status', 'rejected'),
    ),
    fetchInChunks<{ id: string; branch_id: string; nama: string; kategori: string | null; harga: number | null; jumlah_sesi: number | null }>(
      branchIds,
      (c) => supabase.from('internal_layanan').select('id, branch_id, nama, kategori, harga, jumlah_sesi').in('branch_id', c),
    ),
    fetchInChunks<{ id: string; package_name: string; category: string | null; total_sessions: number }>(
      packageIds,
      (c) => supabase.from('patient_packages').select('id, package_name, category, total_sessions').in('id', c),
    ),
  ])

  const patientMap = new Map<string, { name: string; phone: string; no_rm: string | null }>()
  for (const p of patients) {
    try {
      const dec = decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: p.encrypted_phone ?? '' })
      patientMap.set(p.id, { name: dec.name || 'Pasien', phone: dec.phone || '', no_rm: p.no_rm })
    } catch {
      patientMap.set(p.id, { name: 'Pasien', phone: '', no_rm: p.no_rm })
    }
  }

  // Per visit: payments summed; method/status from the latest payment.
  type Pay = { harga: number; discount: number; dibayar: number; kurang: number; method: string | null; status: string | null; date: string }
  const payMap = new Map<string, Pay>()
  for (const t of txns) {
    const prev = payMap.get(t.visit_id)
    const date = t.transaction_date ?? ''
    const latest = !prev || date >= prev.date
    payMap.set(t.visit_id, {
      harga:    Math.max(prev?.harga ?? 0, Number(t.harga ?? 0)),
      discount: (prev?.discount ?? 0) + Number(t.discount ?? 0),
      dibayar:  (prev?.dibayar ?? 0) + Number(t.amount ?? 0),
      kurang:   (prev?.kurang ?? 0) + Number(t.outstanding ?? 0),
      method:   latest ? t.payment_method : prev!.method,
      status:   latest ? t.payment_status : prev!.status,
      date:     latest ? date : prev!.date,
    })
  }

  const layananMap = new Map(layanan.map((l) => [l.id, l]))
  const packageMap = new Map(packages.map((p) => [p.id, p]))

  // Package visits don't store a layanan_id: match the package to the branch's
  // Layanan of the same kategori by name, then by session count.
  const only = <T>(list: T[]) => (list.length === 1 ? list[0] : undefined)
  function packageLayanan(branchId: string, pkg: { package_name: string; category: string | null; total_sessions: number }) {
    const sameCat = layanan.filter((l) => l.branch_id === branchId && l.kategori === (pkg.category ?? 'PAKET SPORT MASSAGE'))
    const norm = (s: string) => s.trim().toLowerCase()
    return only(sameCat.filter((l) => norm(l.nama) === norm(pkg.package_name)))
      ?? only(sameCat.filter((l) => l.jumlah_sesi === pkg.total_sessions))
      ?? only(sameCat)
  }

  return visits.map((v) => {
    const staff = v.internal_profiles as unknown as { full_name: string; nickname: string | null } | null
    const patient = patientMap.get(v.patient_id)
    const pay = payMap.get(v.id)
    const pkg = v.package_id ? packageMap.get(v.package_id) : undefined
    const lay = (v.layanan_id ? layananMap.get(v.layanan_id) : undefined) ?? (pkg ? packageLayanan(v.branch_id, pkg) : undefined)
    return {
      id:             v.id,
      patient_id:     v.patient_id,
      therapist_id:   v.attending_staff_id ?? null,
      layanan_id:     lay?.id ?? null,
      visit_date:     v.visit_date,
      visit_time:     v.visit_time ? String(v.visit_time).slice(0, 5) : null,
      order_id:       v.order_id,
      no_rm:          patient?.no_rm ?? null,
      patient_name:   patient?.name ?? 'Pasien',
      patient_phone:  patient?.phone ?? '',
      therapist_name: staff?.nickname || staff?.full_name || null,
      layanan:        lay?.nama ?? (v.package_id ? `Paket: ${pkg?.package_name ?? '-'}` : null),
      kategori:       lay?.kategori ?? pkg?.category ?? null,
      chief_complaint: v.chief_complaint,
      status:         v.status,
      kehadiran:      v.kehadiran,
      booking_source: v.booking_source,
      harga:          pay?.harga || (pkg ? 0 : Number(lay?.harga ?? 0)),
      discount:       pay?.discount ?? 0,
      dibayar:        pay?.dibayar ?? 0,
      kurang_bayar:   pay?.kurang ?? 0,
      payment_method: pay?.method ?? null,
      payment_status: pay?.status ?? null,
      notes:          v.notes,
    }
  })
}
