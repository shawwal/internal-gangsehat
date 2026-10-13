'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activityLog'
import { STAFF_ROLES, HR_ASSIGNABLE_ROLES } from '@/components/users/types'
import type { UserRole } from '@/components/users/types'

/**
 * Downgrades a director to a branch-scoped staff role. Runs server-side with
 * the service role because the browser-side update against internal_profiles
 * could be silently filtered by RLS (0 rows updated, no error), which left the
 * director stuck on the Direktur tab.
 */
export async function downgradeDirector(targetId: string, newRole: UserRole, branchId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: caller } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'director') return { error: 'Akses ditolak.' }
  if (targetId === user.id) return { error: 'Tidak dapat menurunkan peran akun sendiri.' }
  if (!STAFF_ROLES.includes(newRole)) return { error: 'Peran tidak valid.' }
  if (!branchId) return { error: 'Cabang wajib dipilih.' }

  const admin = createAdminClient()

  const { data: before } = await admin
    .from('internal_profiles')
    .select('role, branch_id, full_name')
    .eq('id', targetId)
    .single()
  if (!before) return { error: 'Pengguna tidak ditemukan.' }

  const { data: updated, error } = await admin
    .from('internal_profiles')
    .update({ role: newRole, branch_id: branchId })
    .eq('id', targetId)
    .select('role, branch_id')
    .single()
  if (error) return { error: error.message }
  if (updated?.role !== newRole || updated?.branch_id !== branchId) {
    return { error: 'Perubahan peran tidak tersimpan.' }
  }

  logActivity({
    supabase, userId: user.id, action: 'update', resourceType: 'internal_profile',
    resourceId: targetId, resourceLabel: before.full_name ?? null, branchId,
    oldValues: { role: before.role, branch_id: before.branch_id }, newValues: { role: newRole, branch_id: branchId },
  })

  return { success: true }
}

/**
 * HR changes the role of a staff member in their own branch. Runs with the
 * service role because HR has no UPDATE policy on internal_profiles. HR can
 * never grant `director` (to anyone — otherwise an accomplice could promote
 * HR back), never touch an existing director, and never change their own role.
 */
export async function changeStaffRoleByHR(targetId: string, newRole: UserRole) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: caller } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'hr') return { error: 'Akses ditolak.' }
  if (!caller.branch_id) return { error: 'Akun Anda belum terhubung ke cabang.' }
  if (targetId === user.id) return { error: 'Tidak dapat mengubah peran akun sendiri.' }
  if (!HR_ASSIGNABLE_ROLES.includes(newRole)) return { error: 'HR hanya dapat menetapkan peran Terapis, Staff, atau Admin.' }

  const admin = createAdminClient()

  const { data: before } = await admin
    .from('internal_profiles')
    .select('role, branch_id, full_name')
    .eq('id', targetId)
    .single()
  if (!before) return { error: 'Pengguna tidak ditemukan.' }
  if (before.role === 'director') return { error: 'Peran direktur hanya dapat diubah oleh direktur.' }
  if (before.branch_id !== caller.branch_id) return { error: 'Pengguna bukan dari cabang Anda.' }
  if (before.role === newRole) return { success: true }

  const { data: updated, error } = await admin
    .from('internal_profiles')
    .update({ role: newRole })
    .eq('id', targetId)
    .eq('branch_id', caller.branch_id)
    .neq('role', 'director')
    .select('role')
    .single()
  if (error) return { error: error.message }
  if (updated?.role !== newRole) return { error: 'Perubahan peran tidak tersimpan.' }

  logActivity({
    supabase, userId: user.id, action: 'update', resourceType: 'internal_profile',
    resourceId: targetId, resourceLabel: before.full_name ?? null, branchId: before.branch_id,
    oldValues: { role: before.role }, newValues: { role: newRole },
  })

  return { success: true }
}

/**
 * HR invites a new staff member into their OWN branch with a chosen role.
 *
 * Why a server action: the invite magic-link path creates the auth user, and
 * the on_auth_user_created_internal trigger then inserts an internal_profiles
 * row hardcoded to role 'staff' with branch_id = NULL. A NULL branch is
 * invisible to HR (RLS "ip: hr reads branch" + the branch filter on the HR
 * page), so HR could never see — let alone finish onboarding — the person they
 * just invited. Here we invite with the service role, then stamp the chosen
 * role and HR's branch onto the freshly-created row so the new hire shows up in
 * HR's branch immediately. HR can pick any staff role (therapist included) but
 * never 'director' (not in STAFF_ROLES) and never 'non-staff'.
 */
export async function inviteStaffByHR(email: string, fullName: string, newRole: UserRole) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: caller } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'hr') return { error: 'Akses ditolak.' }
  if (!caller.branch_id) return { error: 'Akun Anda belum terhubung ke cabang.' }

  const cleanEmail = email.trim().toLowerCase()
  const cleanName  = fullName.trim()
  if (!cleanEmail) return { error: 'Email wajib diisi.' }
  if (cleanName.length < 2) return { error: 'Nama minimal 2 karakter.' }
  if (!HR_ASSIGNABLE_ROLES.includes(newRole)) return { error: 'HR hanya dapat mengundang sebagai Terapis, Staff, atau Admin.' }

  const admin = createAdminClient()

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
    data: { full_name: cleanName },
  })
  if (inviteErr || !invited?.user) {
    return { error: inviteErr?.message ?? 'Gagal mengirim undangan.' }
  }

  // The trigger has already created the internal_profiles row (role 'staff',
  // branch NULL). Stamp the chosen role + HR's branch onto it.
  const { data: updated, error: updErr } = await admin
    .from('internal_profiles')
    .update({ role: newRole, branch_id: caller.branch_id, full_name: cleanName })
    .eq('id', invited.user.id)
    .select('role, branch_id')
    .single()
  if (updErr) return { error: updErr.message }
  if (updated?.role !== newRole || updated?.branch_id !== caller.branch_id) {
    return { error: 'Undangan terkirim tetapi peran/cabang gagal disimpan. Hubungi direktur.' }
  }

  logActivity({
    supabase, userId: user.id, action: 'create', resourceType: 'internal_profile',
    resourceId: invited.user.id, resourceLabel: cleanName, branchId: caller.branch_id,
    newValues: { role: newRole, branch_id: caller.branch_id, email: cleanEmail },
  })

  return { success: true }
}
