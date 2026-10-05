'use server'

// "Dirujuk oleh" — which physiotherapist referred a patient (PFOTM Rujukan SM).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activityLog'

const EDIT_ROLES = ['director', 'manager', 'admin', 'hr', 'therapist', 'staff']

export interface ReferralInfo {
  referredBy: string | null
  referrers: { id: string; name: string }[]
  canEdit: boolean
}

export async function getPatientReferral(patientId: string): Promise<ReferralInfo | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: me }, { data: patient }] = await Promise.all([
    supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single(),
    supabase.from('patients').select('referred_by_staff_id').eq('id', patientId).maybeSingle(),
  ])
  if (!me) return null

  // Referrers: active physiotherapists (own branch; all branches for director).
  let q = createAdminClient()
    .from('internal_profiles')
    .select('id, full_name, nickname, branch_id')
    .eq('is_active', true)
    .eq('role', 'therapist')
    .order('full_name')
  if (me.role !== 'director' && me.branch_id) q = q.eq('branch_id', me.branch_id)
  const { data: staff } = await q
  const referrers = (staff ?? []).map((s) => ({ id: s.id, name: s.nickname?.trim() ? `${s.full_name} (${s.nickname})` : s.full_name }))

  // Keep the current referrer visible even if they moved branch.
  const referredBy = (patient?.referred_by_staff_id as string | null) ?? null
  if (referredBy && !referrers.some((r) => r.id === referredBy)) {
    const { data: cur } = await createAdminClient().from('internal_profiles').select('id, full_name').eq('id', referredBy).maybeSingle()
    if (cur) referrers.unshift({ id: cur.id, name: cur.full_name })
  }

  return { referredBy, referrers, canEdit: EDIT_ROLES.includes(me.role) }
}

export async function setPatientReferral(patientId: string, staffId: string | null): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: me } = await supabase.from('internal_profiles').select('role').eq('id', user.id).single()
  if (!me || !EDIT_ROLES.includes(me.role)) return { error: 'Tidak memiliki akses.' }

  if (staffId) {
    const { data: staff } = await supabase.from('internal_profiles').select('id, is_active').eq('id', staffId).maybeSingle()
    if (!staff?.is_active) return { error: 'Fisioterapis tidak ditemukan.' }
  }

  const { data: before } = await supabase.from('patients').select('referred_by_staff_id').eq('id', patientId).maybeSingle()
  // Role is verified above; the service client avoids depending on a patients
  // UPDATE policy for this single column (same approach as updatePatient).
  const { error } = await createAdminClient().from('patients').update({ referred_by_staff_id: staffId }).eq('id', patientId)
  if (error) return { error: error.message }

  await logActivity({
    supabase, userId: user.id, action: 'update', resourceType: 'patient', resourceId: patientId,
    resourceLabel: 'Dirujuk oleh', patientId,
    oldValues: { referred_by_staff_id: before?.referred_by_staff_id ?? null },
    newValues: { referred_by_staff_id: staffId },
  })
  return { error: null }
}
