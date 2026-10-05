'use server'

import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'

// Griya Anak packages are attached to a child's recurring slots
// (griya_schedule_slots.package_id), not to the child as a whole — a child can
// run several disciplines, each on its own package. markAttendance & co. copy
// slot.package_id onto every session, and "Pertemuan Ke-N" is the visit's
// position inside its package (lib/internal/visitInsights.ts::fetchPackagePositions),
// so re-pointing slots at a new package is what resets the counter to 1.

const WRITE_ROLES = ['director', 'manager', 'admin']

type SupaClient = Awaited<ReturnType<typeof createClient>>
type AuthOk = { supabase: SupaClient; userId: string }

async function requireWrite(): Promise<AuthOk | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase
    .from('internal_profiles').select('role').eq('id', user.id).single()
  if (!profile || !WRITE_ROLES.includes(profile.role as string)) return { error: 'Tidak memiliki akses' }
  return { supabase, userId: user.id }
}

const today = () => new Date().toISOString().slice(0, 10)

function stopPatch(userId: string) {
  return {
    status:             'stopped',
    operational_status: 'OFF',
    stopped_at:         today(),
    stopped_by:         userId,
    updated_at:         new Date().toISOString(),
  }
}

/**
 * Puts `packageId` on the given recurring slots, starting `fromDate`:
 *  - the slots now point at the new package (future sessions attach to it),
 *  - their visits from `fromDate` on that had no package / the replaced one move over,
 *  - the package previously on those slots is stopped, unless another active
 *    slot of the child still uses it.
 */
export async function startGriyaPackage(input: {
  packageId: string
  slotIds: string[]
  fromDate: string
}): Promise<{ error: string | null; stopped: number; relinked: number }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error, stopped: 0, relinked: 0 }
  const { supabase, userId } = a
  if (input.slotIds.length === 0) return { error: 'Pilih minimal satu jadwal.', stopped: 0, relinked: 0 }

  const { data: pkg } = await supabase
    .from('patient_packages')
    .select('id, patient_id, branch_id, package_name, status')
    .eq('id', input.packageId)
    .single()
  if (!pkg) return { error: 'Paket tidak ditemukan.', stopped: 0, relinked: 0 }
  if (pkg.status !== 'active') return { error: 'Paket tidak aktif.', stopped: 0, relinked: 0 }

  const { data: slots } = await supabase
    .from('griya_schedule_slots')
    .select('id, package_id')
    .in('id', input.slotIds)
    .eq('patient_id', pkg.patient_id)
    .eq('status', 'active')
  if (!slots || slots.length === 0) return { error: 'Jadwal rutin tidak ditemukan.', stopped: 0, relinked: 0 }
  const slotIds = slots.map((s) => s.id as string)
  const prevPkgIds = [...new Set(
    slots.map((s) => s.package_id as string | null).filter((p): p is string => !!p && p !== pkg.id),
  )]

  const { error: slotErr } = await supabase
    .from('griya_schedule_slots')
    .update({ package_id: pkg.id, updated_at: new Date().toISOString() })
    .in('id', slotIds)
  if (slotErr) return { error: slotErr.message, stopped: 0, relinked: 0 }

  // Re-link the slots' sessions from fromDate onward (Terapi Awal is never a package session).
  const { data: visits } = await supabase
    .from('patient_visits')
    .select('id, package_id, service_type')
    .in('griya_slot_id', slotIds)
    .gte('visit_date', input.fromDate)
    .neq('status', 'cancelled')
  const relinkIds = (visits ?? [])
    .filter((v) => v.service_type !== 'TERAPI AWAL')
    .filter((v) => !v.package_id || prevPkgIds.includes(v.package_id as string))
    .map((v) => v.id as string)
  if (relinkIds.length > 0) {
    const { error } = await supabase
      .from('patient_visits')
      .update({ package_id: pkg.id, updated_at: new Date().toISOString() })
      .in('id', relinkIds)
    if (error) return { error: error.message, stopped: 0, relinked: 0 }
  }

  // Stop the replaced package(s) — only once no other active slot still runs on them.
  let stopped = 0
  if (prevPkgIds.length > 0) {
    const { data: stillUsed } = await supabase
      .from('griya_schedule_slots')
      .select('package_id')
      .in('package_id', prevPkgIds)
      .eq('status', 'active')
    const keep = new Set((stillUsed ?? []).map((s) => s.package_id as string))
    const toStop = prevPkgIds.filter((id) => !keep.has(id))
    if (toStop.length > 0) {
      const { data: done, error } = await supabase
        .from('patient_packages')
        .update(stopPatch(userId))
        .in('id', toStop)
        .eq('status', 'active')
        .select('id')
      if (error) return { error: error.message, stopped: 0, relinked: relinkIds.length }
      stopped = done?.length ?? 0
    }
  }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'patient_package',
    resourceId: pkg.id, resourceLabel: pkg.package_name as string,
    branchId: pkg.branch_id as string | null, patientId: pkg.patient_id as string,
    newValues: { slot_ids: slotIds, from_date: input.fromDate, relinked_visits: relinkIds.length, stopped_packages: prevPkgIds },
  })

  return { error: null, stopped, relinked: relinkIds.length }
}

/**
 * Ends a package early. Its slots are unlinked so new sessions no longer count
 * against it, and so are its booked-but-not-yet-attended future visits.
 * Attended history stays on the package.
 */
export async function stopGriyaPackage(packageId: string): Promise<{ error: string | null }> {
  const a = await requireWrite()
  if ('error' in a) return { error: a.error }
  const { supabase, userId } = a

  const { data: pkg } = await supabase
    .from('patient_packages')
    .select('id, patient_id, branch_id, package_name, status')
    .eq('id', packageId)
    .single()
  if (!pkg) return { error: 'Paket tidak ditemukan.' }
  if (pkg.status !== 'active') return { error: 'Paket sudah tidak aktif.' }

  const { error } = await supabase
    .from('patient_packages')
    .update(stopPatch(userId))
    .eq('id', packageId)
    .eq('status', 'active')
  if (error) return { error: error.message }

  const now = new Date().toISOString()
  const [slotRes, visitRes] = await Promise.all([
    supabase
      .from('griya_schedule_slots')
      .update({ package_id: null, updated_at: now })
      .eq('package_id', packageId),
    supabase
      .from('patient_visits')
      .update({ package_id: null, updated_at: now })
      .eq('package_id', packageId)
      .eq('status', 'scheduled')
      .is('kehadiran', null)
      .gte('visit_date', today()),
  ])
  if (slotRes.error) return { error: slotRes.error.message }
  if (visitRes.error) return { error: visitRes.error.message }

  await logActivity({
    supabase, userId, action: 'update', resourceType: 'patient_package',
    resourceId: pkg.id, resourceLabel: pkg.package_name as string,
    branchId: pkg.branch_id as string | null, patientId: pkg.patient_id as string,
    oldValues: { status: 'active' }, newValues: { status: 'stopped' },
  })

  return { error: null }
}
