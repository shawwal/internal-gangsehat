'use server'

import { createClient } from '@/lib/supabase/server'

export interface LayananRow {
  id: string
  branch_id: string
  nama: string
  kategori: string
  jumlah_sesi: number | null
  harga: number
  is_active: boolean
  created_at: string
  /** NULL = not bookable on gangsehat.com; else the visit service_type it books (110-online-booking.sql) */
  online_service_type?: OnlineServiceType | null
  deskripsi?: string | null
  /** Payroll activity code → units counted per LUNAS/PELUNASAN payment (115-layanan-activity-tags.sql) */
  payroll_units?: Record<string, number>
  /** PFOTM sales column this Layanan counts toward */
  pfotm_metric?: PfotmLayananMetric | null
}

export type PfotmLayananMetric = 'paket_1' | 'paket_2' | 'paket_3' | 'terapi_awal_sesi_visit' | 'paket_visit'

export type OnlineServiceType = 'TERAPI AWAL KLINIK' | 'SESI KLINIK'

export async function fetchLayananByBranch(branchId: string): Promise<LayananRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_layanan')
    .select('id, branch_id, nama, kategori, jumlah_sesi, harga, is_active, created_at, online_service_type, deskripsi, payroll_units, pfotm_metric')
    .eq('branch_id', branchId)
    .order('kategori')
  return (data ?? []) as LayananRow[]
}

/** A Layanan kategori = an income category (income_categories, migration 119). */
export interface LayananKategori {
  code: string
  label: string
}

// TOKO is written by /toko sales only — never a price-list kategori.
const NON_LAYANAN_KATEGORI = ['TOKO']

/** Kategori a Layanan can be filed under, in display order. */
export async function fetchLayananKategori(): Promise<LayananKategori[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('income_categories')
    .select('code, label')
    .order('sort_order')
    .order('code')
  return ((data ?? []) as LayananKategori[]).filter((k) => !NON_LAYANAN_KATEGORI.includes(k.code))
}

/**
 * Director: add a kategori. The code is the name in capitals ("Terapi Wicara" →
 * "TERAPI WICARA"), like every existing kategori. It slots in before TOKO / LAINNYA.
 */
export async function createLayananKategori(
  name: string,
): Promise<{ data: LayananKategori | null; error: string | null }> {
  const code = name.trim().replace(/\s+/g, ' ').toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9 &/-]{1,39}$/.test(code)) {
    return { data: null, error: 'Nama kategori 2–40 karakter: huruf, angka, spasi, & / -' }
  }
  const label = code.toLowerCase().replace(/(^|[\s/-])\S/g, (c) => c.toUpperCase())

  const supabase = await createClient()
  const { data: existing } = await supabase.from('income_categories').select('code, sort_order')
  const rows = (existing ?? []) as { code: string; sort_order: number }[]
  if (rows.some((r) => r.code === code)) return { data: null, error: `Kategori "${code}" sudah ada` }
  const last = Math.max(0, ...rows.filter((r) => r.code !== 'TOKO' && r.code !== 'LAINNYA').map((r) => r.sort_order))

  const { error } = await supabase
    .from('income_categories')
    .insert({ code, label, sort_order: last + 1 })
  if (error) {
    return { data: null, error: error.code === '42501' ? 'Hanya direktur yang dapat menambah kategori.' : error.message }
  }
  return { data: { code, label }, error: null }
}

/** Payroll activity columns a Layanan can count toward (Tarif Layanan → "Dihitung untuk"). */
export async function fetchPayrollActivityOptions(): Promise<{ code: string; label: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('payroll_activity_types')
    .select('code, label')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as { code: string; label: string }[]
}

// Active Sport Massage service types for a branch — each row is one bookable
// type with its own price (e.g. "Sport Massage 60 menit", "... 90 menit").
export async function fetchSportMassageLayanan(branchId: string): Promise<LayananRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_layanan')
    .select('id, branch_id, nama, kategori, jumlah_sesi, harga, is_active, created_at')
    .eq('branch_id', branchId)
    .eq('kategori', 'SPORT MASSAGE')
    .eq('is_active', true)
    .order('harga', { ascending: true })
    .order('nama', { ascending: true })
  return (data ?? []) as LayananRow[]
}

export async function updateLayananHarga(
  id: string,
  harga: number,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_layanan')
    .update({ harga })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function updateLayanan(
  id: string,
  patch: { nama: string; kategori: string; jumlah_sesi: number | null; harga: number },
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_layanan')
    .update({
      nama: patch.nama.trim(),
      kategori: patch.kategori,
      jumlah_sesi: patch.jumlah_sesi,
      harga: patch.harga,
    })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function upsertLayanan(
  row: Omit<LayananRow, 'created_at'>,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const payload = row.id
    ? row
    : { ...row, id: undefined }
  const { error } = await supabase
    .from('internal_layanan')
    .upsert(payload, { onConflict: 'id' })
  return { error: error?.message ?? null }
}

/** Director setting: which services patients can book + pay online. */
export async function setLayananOnlineServiceType(
  id: string,
  value: OnlineServiceType | null,
): Promise<{ error: string | null }> {
  if (value !== null && value !== 'TERAPI AWAL KLINIK' && value !== 'SESI KLINIK') return { error: 'Nilai tidak valid' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_layanan')
    .update({ online_service_type: value })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function toggleLayananActive(
  id: string,
  is_active: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_layanan')
    .update({ is_active })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteLayanan(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_layanan')
    .delete()
    .eq('id', id)
  return { error: error?.message ?? null }
}
