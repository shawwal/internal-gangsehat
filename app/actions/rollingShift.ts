'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getShiftForStaffOnDate,
  getPeriodeKe,
  getPolaAktif,
  getShiftForDay,
  jsDayToHariKey,
  type ShiftPatternRow,
  type ShiftValue,
  type TeamName,
} from '@/lib/shift/rollingShift'

// ── Types ────────────────────────────────────────────────────────────────────
export interface ShiftPattern {
  id: string
  branch_id: string
  code: 'X' | 'Y'
  name: string | null
  senin: ShiftValue
  selasa: ShiftValue
  rabu: ShiftValue
  kamis: ShiftValue
  jumat: ShiftValue
  sabtu: ShiftValue
}

export interface ShiftTeam {
  id: string
  branch_id: string
  name: TeamName
  pola_x_id: string
  pola_y_id: string
  anchor_date: string
  is_active: boolean
}

export interface ShiftTeamMember {
  id: string
  team_id: string
  staff_id: string
  effective_start_date: string
  effective_end_date: string | null
  staff_name?: string
}

export interface ShiftPatternInput {
  branch_id: string
  code: 'X' | 'Y'
  name?: string | null
  senin: ShiftValue
  selasa: ShiftValue
  rabu: ShiftValue
  kamis: ShiftValue
  jumat: ShiftValue
  sabtu: ShiftValue
}

export interface ShiftTeamInput {
  branch_id: string
  name: TeamName
  pola_x_id: string
  pola_y_id: string
  anchor_date: string
}

// ── Fetch ────────────────────────────────────────────────────────────────────
export async function fetchShiftPatterns(branchId: string): Promise<ShiftPattern[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shift_patterns')
    .select('id, branch_id, code, name, senin, selasa, rabu, kamis, jumat, sabtu')
    .eq('branch_id', branchId)
    .order('code')
  return (data ?? []) as ShiftPattern[]
}

export async function fetchShiftTeams(branchId: string): Promise<ShiftTeam[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shift_teams')
    .select('id, branch_id, name, pola_x_id, pola_y_id, anchor_date, is_active')
    .eq('branch_id', branchId)
    .order('name')
  return (data ?? []) as ShiftTeam[]
}

export async function fetchTeamMembers(teamId: string): Promise<ShiftTeamMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shift_team_members')
    .select('id, team_id, staff_id, effective_start_date, effective_end_date, internal_profiles!staff_id(full_name)')
    .eq('team_id', teamId)
    .is('effective_end_date', null)
    .order('effective_start_date')

  return (data ?? []).map((r) => ({
    id: r.id,
    team_id: r.team_id,
    staff_id: r.staff_id,
    effective_start_date: r.effective_start_date,
    effective_end_date: r.effective_end_date,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    staff_name: (r as any).internal_profiles?.full_name ?? 'Unknown',
  }))
}

/** Staff already on the flat weekly `schedules` table — used to warn against dual-assignment. */
export async function fetchStaffOnFlatSchedule(branchId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('schedules')
    .select('staff_id')
    .eq('branch_id', branchId)
  return [...new Set((data ?? []).map((r) => r.staff_id as string))]
}

// ── Mutate: patterns ─────────────────────────────────────────────────────────
export async function saveShiftPattern(
  input: ShiftPatternInput,
  id?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  if (id) {
    const { error } = await supabase.from('shift_patterns').update(input).eq('id', id)
    return { error: error?.message ?? null }
  }
  const { error } = await supabase.from('shift_patterns').insert(input)
  return { error: error?.message ?? null }
}

// ── Mutate: teams ────────────────────────────────────────────────────────────
export async function saveShiftTeam(
  input: ShiftTeamInput,
  id?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  if (id) {
    const { error } = await supabase.from('shift_teams').update(input).eq('id', id)
    return { error: error?.message ?? null }
  }
  const { error } = await supabase.from('shift_teams').insert(input)
  return { error: error?.message ?? null }
}

// ── Mutate: team members ─────────────────────────────────────────────────────
export async function assignStaffToTeam(
  teamId: string,
  staffId: string,
  effectiveStartDate: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Close out any existing active membership for this staff member first
  // (both mutual-exclusivity with other teams, and the DB's one-active-row constraint).
  const { error: closeErr } = await supabase
    .from('shift_team_members')
    .update({ effective_end_date: effectiveStartDate })
    .eq('staff_id', staffId)
    .is('effective_end_date', null)
  if (closeErr) return { error: closeErr.message }

  const { error } = await supabase.from('shift_team_members').insert({
    team_id: teamId,
    staff_id: staffId,
    effective_start_date: effectiveStartDate,
    effective_end_date: null,
  })
  return { error: error?.message ?? null }
}

export async function removeStaffFromTeam(
  memberId: string,
  effectiveEndDate: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('shift_team_members')
    .update({ effective_end_date: effectiveEndDate })
    .eq('id', memberId)
  return { error: error?.message ?? null }
}

// ── Resolve shift for a staff+date (used by the visit form) ──────────────────
export async function resolveShiftForStaffDate(
  staffId: string,
  isoDate: string,
): Promise<{ shift: ShiftValue | null; source: 'rolling' | 'override' | null }> {
  const supabase = await createClient()
  const date = new Date(`${isoDate}T00:00:00`)
  const result = await getShiftForStaffOnDate(supabase, staffId, date)
  if (!result) return { shift: null, source: null }
  return { shift: result.shift, source: result.source }
}

// ── Preview a team's derived schedule over a date range ──────────────────────
export interface PreviewDay {
  date: string
  shift: ShiftValue
  isDerived: boolean // true for Minggu cells (never stored, always computed)
}

export async function previewTeamSchedule(
  teamId: string,
  startDate: string,
  endDate: string,
): Promise<PreviewDay[]> {
  const supabase = await createClient()
  const { data: team } = await supabase
    .from('shift_teams')
    .select('name, anchor_date, pola_x_id, pola_y_id')
    .eq('id', teamId)
    .single()
  if (!team) return []

  const { data: patterns } = await supabase
    .from('shift_patterns')
    .select('id, senin, selasa, rabu, kamis, jumat, sabtu')
    .in('id', [team.pola_x_id, team.pola_y_id])

  const polaX = patterns?.find((p) => p.id === team.pola_x_id) as ShiftPatternRow | undefined
  const polaY = patterns?.find((p) => p.id === team.pola_y_id) as ShiftPatternRow | undefined
  if (!polaX || !polaY) return []

  const anchorMonday = new Date(`${team.anchor_date}T00:00:00`)
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const days: PreviewDay[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const periodeKe = getPeriodeKe(d, anchorMonday)
    const pola = getPolaAktif(team.name as TeamName, periodeKe, polaX, polaY)
    const hari = jsDayToHariKey(d)
    days.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      shift: getShiftForDay(pola, hari),
      isDerived: hari === 'minggu',
    })
  }
  return days
}
