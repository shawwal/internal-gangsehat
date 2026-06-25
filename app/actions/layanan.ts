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
}

export async function fetchLayananByBranch(branchId: string): Promise<LayananRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_layanan')
    .select('id, branch_id, nama, kategori, jumlah_sesi, harga, is_active, created_at')
    .eq('branch_id', branchId)
    .order('kategori')
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
