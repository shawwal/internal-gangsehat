'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activityLog'
import { STAFF_ROLES } from '@/components/users/types'
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
