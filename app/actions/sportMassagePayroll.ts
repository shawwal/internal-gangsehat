'use server'

import { createClient } from '@/lib/supabase/server'
import { getPayrollWindow } from '@/app/actions/pfotm'
import { fetchSportMassageExportRows, type SportMassageExportRow } from '@/app/actions/sportMassageExport'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/** Roles that may open the page / edit the fee rates (RLS enforces the same). */
const VIEW_ROLES = ['director', 'manager', 'admin', 'hr']
const RATE_ROLES = ['director', 'manager']

export interface SportMassagePayrollLayanan {
  id: string
  nama: string
  kategori: string
  harga: number
  is_active: boolean
}

export interface SportMassagePayrollTherapist {
  id: string
  name: string
  is_active: boolean
}

export interface SportMassageFeeRate {
  /** null = branch default for the Layanan */
  staff_id: string | null
  layanan_id: string
  fee: number
}

export interface SportMassagePayrollData {
  start: string
  end: string
  canEditRates: boolean
  visits: SportMassageExportRow[]
  layanan: SportMassagePayrollLayanan[]
  therapists: SportMassagePayrollTherapist[]
  rates: SportMassageFeeRate[]
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (!profile) return null
  return { supabase, userId: user.id, role: profile.role as string, branchId: profile.branch_id as string | null }
}

/** Sport Massage visits, Layanan, roster and fee rates for one payroll period (27 → 26) of a branch. */
export async function fetchSportMassagePayroll(branchId: string, year: number, month: number): Promise<Result<SportMassagePayrollData>> {
  const actor = await getActor()
  if (!actor) return { ok: false, error: 'Sesi berakhir, silakan login ulang.' }
  if (!VIEW_ROLES.includes(actor.role)) return { ok: false, error: 'Anda tidak memiliki akses.' }
  if (actor.role !== 'director' && actor.role !== 'hr' && actor.branchId !== branchId) return { ok: false, error: 'Anda tidak memiliki akses.' }

  const win = await getPayrollWindow(branchId, year, month)
  if (!win.ok) return win
  const { start, end } = win.data
  const { supabase } = actor

  try {
    const [visits, layananRes, rosterRes, ratesRes] = await Promise.all([
      fetchSportMassageExportRows(start, end, branchId),
      supabase.from('internal_layanan')
        .select('id, nama, kategori, harga, is_active')
        .eq('branch_id', branchId)
        .in('kategori', ['SPORT MASSAGE', 'PAKET SPORT MASSAGE'])
        .order('kategori').order('harga').order('nama'),
      supabase.from('internal_profiles')
        .select('id, full_name, nickname, is_active')
        .eq('branch_id', branchId)
        .eq('role', 'sport_massage_therapist'),
      supabase.from('sport_massage_fee_rates')
        .select('staff_id, layanan_id, fee')
        .eq('branch_id', branchId),
    ])
    if (layananRes.error) throw layananRes.error
    if (rosterRes.error) throw rosterRes.error
    if (ratesRes.error) throw ratesRes.error

    // Roster = the branch's sport massage therapists + anyone else who ran a session in the period.
    const therapists = new Map<string, SportMassagePayrollTherapist>()
    for (const p of rosterRes.data ?? []) {
      therapists.set(p.id, { id: p.id, name: p.nickname?.trim() || p.full_name, is_active: !!p.is_active })
    }
    for (const v of visits) {
      if (v.therapist_id && !therapists.has(v.therapist_id)) {
        therapists.set(v.therapist_id, { id: v.therapist_id, name: v.therapist_name ?? '—', is_active: true })
      }
    }

    return {
      ok: true,
      data: {
        start, end,
        canEditRates: RATE_ROLES.includes(actor.role),
        visits,
        layanan: (layananRes.data ?? []).map((l) => ({ ...l, harga: Number(l.harga) })) as SportMassagePayrollLayanan[],
        therapists: [...therapists.values()].sort((a, b) => a.name.localeCompare(b.name, 'id')),
        rates: (ratesRes.data ?? []).map((r) => ({ ...r, fee: Number(r.fee) })) as SportMassageFeeRate[],
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Gagal memuat data payroll sport massage.' }
  }
}

/**
 * Replace the branch's fee rates with `rates` — one entry per (therapist|default, Layanan).
 * Entries left out (cleared inputs) are deleted.
 */
export async function saveSportMassageFeeRates(branchId: string, rates: SportMassageFeeRate[]): Promise<Result<null>> {
  const actor = await getActor()
  if (!actor) return { ok: false, error: 'Sesi berakhir, silakan login ulang.' }
  if (!RATE_ROLES.includes(actor.role)) return { ok: false, error: 'Hanya direktur / manajer yang dapat mengubah tarif.' }
  if (actor.role !== 'director' && actor.branchId !== branchId) return { ok: false, error: 'Anda tidak memiliki akses.' }
  if (rates.some((r) => !Number.isFinite(r.fee) || r.fee < 0)) return { ok: false, error: 'Tarif tidak valid.' }

  const { supabase, userId } = actor
  const key = (r: { staff_id: string | null; layanan_id: string }) => `${r.staff_id ?? ''}:${r.layanan_id}`

  if (rates.length > 0) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('sport_massage_fee_rates').upsert(
      rates.map((r) => ({
        branch_id: branchId, staff_id: r.staff_id, layanan_id: r.layanan_id, fee: r.fee,
        updated_by: userId, updated_at: now,
      })),
      { onConflict: 'branch_id,staff_id,layanan_id' },
    )
    if (error) return { ok: false, error: error.message }
  }

  const { data: existing, error: readError } = await supabase
    .from('sport_massage_fee_rates').select('id, staff_id, layanan_id').eq('branch_id', branchId)
  if (readError) return { ok: false, error: readError.message }
  const keep = new Set(rates.map(key))
  const stale = (existing ?? []).filter((r) => !keep.has(key(r))).map((r) => r.id)
  if (stale.length > 0) {
    const { error } = await supabase.from('sport_massage_fee_rates').delete().in('id', stale)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true, data: null }
}
