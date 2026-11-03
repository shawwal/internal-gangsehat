// Server side of lib/griyaBranch.ts — which Griya branch a /griya-anak request is about.

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GRIYA_BRANCH_COOKIE, parseGriyaBranch } from '@/lib/griyaBranch'

type SupaClient = Awaited<ReturnType<typeof createClient>>

export interface GriyaBranchOption { id: string; name: string }

export interface GriyaBranchContextValue {
  role: string | null
  /** The caller's own branch (NULL for director). */
  homeBranchId: string | null
  /** The branch the Griya pages show. */
  branchId: string | null
  branchName: string | null
  enabled: boolean          // feature gate for branchId
  canEdit: boolean
  /** Director, or admin of a Griya-enabled branch — may pick from `branches`. */
  canSwitch: boolean
  branches: GriyaBranchOption[]
}

const EDIT_ROLES = ['director', 'manager', 'admin']

/** Mirrors get_my_branch() (supabase/130): admin + own branch Griya-enabled →
 *  any active Griya-enabled branch; director → any; others → own branch. */
export async function loadGriyaBranchContext(): Promise<GriyaBranchContextValue> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const empty: GriyaBranchContextValue = {
    role: null, homeBranchId: null, branchId: null, branchName: null,
    enabled: false, canEdit: false, canSwitch: false, branches: [],
  }
  if (!user) return empty

  const { data: profile } = await supabase
    .from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  const role = (profile?.role as string | undefined) ?? null
  const home = (profile?.branch_id as string | null | undefined) ?? null

  // Branch names outside the caller's own are hidden by RLS — read them with
  // the service role; only Griya-enabled ids and names leave this function.
  const admin = createAdminClient()
  const { data: settings } = await admin.from('branch_griya_settings').select('branch_id').eq('enabled', true)
  const enabledIds = new Set((settings ?? []).map((s) => s.branch_id as string))
  const { data: active } = enabledIds.size > 0
    ? await admin.from('branches').select('id, name').eq('is_active', true).in('id', [...enabledIds]).order('name')
    : { data: [] }
  const griyaBranches = (active ?? []) as GriyaBranchOption[]

  const canSwitch = role === 'director' || (role === 'admin' && !!home && enabledIds.has(home))
  let branchId = home
  if (canSwitch) {
    const picked = parseGriyaBranch((await cookies()).get(GRIYA_BRANCH_COOKIE)?.value)
    const pick = griyaBranches.find((b) => b.id === picked)
      ?? griyaBranches.find((b) => b.id === home)
      ?? (role === 'director' ? griyaBranches.find((b) => /griya anak/i.test(b.name)) ?? griyaBranches[0] : undefined)
    branchId = pick?.id ?? home
  }

  let branchName = griyaBranches.find((b) => b.id === branchId)?.name ?? null
  if (branchId && !branchName) {
    const { data: b } = await admin.from('branches').select('name').eq('id', branchId).maybeSingle()
    branchName = (b?.name as string | undefined) ?? null
  }

  return {
    role,
    homeBranchId: home,
    branchId,
    branchName,
    enabled: !!branchId && (role === 'director' || enabledIds.has(branchId)),
    canEdit: !!role && EDIT_ROLES.includes(role),
    canSwitch,
    branches: canSwitch ? griyaBranches : griyaBranches.filter((b) => b.id === home),
  }
}

/** The branch RLS treats as the caller's on this request: their own branch, or
 *  — for an admin on /griya-anak — the Griya branch they picked. `supabase` must
 *  be this request's user client (lib/supabase/server). */
export async function actingBranchId(supabase: SupaClient, profileBranchId: string | null): Promise<string | null> {
  if (!profileBranchId) return null
  const picked = parseGriyaBranch((await cookies()).get(GRIYA_BRANCH_COOKIE)?.value)
  if (!picked || picked === profileBranchId) return profileBranchId
  const { data } = await supabase.rpc('get_my_branch')
  return (data as string | null) ?? profileBranchId
}
