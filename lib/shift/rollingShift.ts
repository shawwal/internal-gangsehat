import type { SupabaseClient } from '@supabase/supabase-js'

// ── Rolling shift (Tim A / Tim B) rotation logic ────────────────────────────
// Two teams per branch, each running a fixed Senin-Sabtu pattern (Pola X or
// Pola Y) for a 2-week period, swapping patterns every period. Minggu is
// never stored — it's always derived from that week's Sabtu shift.

export type ShiftValue = 'PAGI' | 'SORE' | 'OFF'
export type HariKey = 'senin' | 'selasa' | 'rabu' | 'kamis' | 'jumat' | 'sabtu'
export type TeamName = 'A' | 'B'

export interface ShiftPatternRow {
  senin: ShiftValue
  selasa: ShiftValue
  rabu: ShiftValue
  kamis: ShiftValue
  jumat: ShiftValue
  sabtu: ShiftValue
}

// JS Date.getDay(): 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
const JS_DAY_TO_HARI_KEY: Array<HariKey | 'minggu'> = [
  'minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu',
]

export function jsDayToHariKey(date: Date): HariKey | 'minggu' {
  return JS_DAY_TO_HARI_KEY[date.getDay()]
}

// Uppercase Indonesian day codes as used by `schedules`/`schedule_overrides`.hari
const JS_DAY_TO_HARI_UPPER = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']

/** Sunday's shift is always derived from that week's Saturday shift. */
export function getShiftMinggu(shiftSabtu: ShiftValue): ShiftValue {
  if (shiftSabtu === 'SORE') return 'PAGI'
  if (shiftSabtu === 'PAGI') return 'SORE'
  return shiftSabtu // OFF fallback
}

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/** periodeKe starts at 1. Weeks are anchored to `anchorMonday` (Monday of periode 1, week 1). */
export function getPeriodeKe(date: Date, anchorMonday: Date): number {
  const msPerDay = 86400000
  const weeksSince = Math.floor((startOfDayUTC(date) - startOfDayUTC(anchorMonday)) / (7 * msPerDay))
  return Math.floor(weeksSince / 2) + 1
}

/** Which pattern (Pola X or Pola Y) is active for a team in a given period. */
export function getPolaAktif(
  tim: TeamName,
  periodeKe: number,
  polaX: ShiftPatternRow,
  polaY: ShiftPatternRow,
): ShiftPatternRow {
  const isGanjil = periodeKe % 2 === 1
  if (tim === 'A') return isGanjil ? polaX : polaY
  return isGanjil ? polaY : polaX
}

/** Day-of-week lookup within a pattern, with Minggu always derived from Sabtu. */
export function getShiftForDay(pola: ShiftPatternRow, hari: HariKey | 'minggu'): ShiftValue {
  if (hari === 'minggu') return getShiftMinggu(pola.sabtu)
  return pola[hari]
}

// ── DB-backed resolver ──────────────────────────────────────────────────────

export interface ResolvedShift {
  shift: ShiftValue
  source: 'rolling' | 'override'
}

/**
 * Resolves the shift a staff member is working on a given date, based on
 * their rolling-team assignment (if any) and any active schedule_overrides
 * exception. Returns null when the staff member has no active rolling-team
 * membership for that date — callers should fall back to the flat
 * `schedules` table in that case.
 */
export async function getShiftForStaffOnDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  staffId: string,
  date: Date,
): Promise<ResolvedShift | null> {
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const { data: membership } = await supabase
    .from('shift_team_members')
    .select('team_id, effective_start_date, effective_end_date')
    .eq('staff_id', staffId)
    .lte('effective_start_date', isoDate)
    .or(`effective_end_date.is.null,effective_end_date.gte.${isoDate}`)
    .maybeSingle()

  if (!membership) return null

  const { data: team } = await supabase
    .from('shift_teams')
    .select('name, anchor_date, pola_x_id, pola_y_id')
    .eq('id', membership.team_id)
    .single()

  if (!team) return null

  const { data: patterns } = await supabase
    .from('shift_patterns')
    .select('id, senin, selasa, rabu, kamis, jumat, sabtu')
    .in('id', [team.pola_x_id, team.pola_y_id])

  const polaX = patterns?.find((p) => p.id === team.pola_x_id)
  const polaY = patterns?.find((p) => p.id === team.pola_y_id)
  if (!polaX || !polaY) return null

  const anchorMonday = new Date(`${team.anchor_date}T00:00:00`)
  const periodeKe = getPeriodeKe(date, anchorMonday)
  const pola = getPolaAktif(team.name as TeamName, periodeKe, polaX, polaY)
  const hari = jsDayToHariKey(date)
  const shift = getShiftForDay(pola, hari)

  const { data: override } = await supabase
    .from('schedule_overrides')
    .select('shift')
    .eq('staff_id', staffId)
    .eq('status', 'active')
    .eq('hari', JS_DAY_TO_HARI_UPPER[date.getDay()])
    .lte('start_date', isoDate)
    .gte('end_date', isoDate)
    .maybeSingle()

  if (override?.shift) return { shift: override.shift as ShiftValue, source: 'override' }
  return { shift, source: 'rolling' }
}
