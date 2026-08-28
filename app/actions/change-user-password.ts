'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activityLog'

/**
 * Sets a new password for another internal user.
 * - director: may change any account's password
 * - manager: may change passwords only for non-director accounts in their own branch
 * Nobody may change their own password here (use Settings).
 */
export async function changeUserPassword(targetId: string, password: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Kata sandi minimal 8 karakter.' }
  }
  if (targetId === user.id) {
    return { error: 'Ubah kata sandi akun sendiri melalui halaman Pengaturan.' }
  }

  const { data: caller } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'director' && caller?.role !== 'manager') {
    return { error: 'Akses ditolak.' }
  }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('internal_profiles')
    .select('id, full_name, role, branch_id')
    .eq('id', targetId)
    .single()

  if (!target) return { error: 'Pengguna tidak ditemukan.' }

  if (caller.role === 'manager') {
    if (target.role === 'director') return { error: 'Akses ditolak.' }
    if (!caller.branch_id || target.branch_id !== caller.branch_id) {
      return { error: 'Hanya dapat mengubah kata sandi pengguna di cabang Anda.' }
    }
  }

  const { error } = await admin.auth.admin.updateUserById(targetId, { password })
  if (error) return { error: error.message }

  logActivity({
    supabase, userId: user.id, action: 'update', resourceType: 'internal_profile',
    resourceId: targetId, resourceLabel: target.full_name ?? null, branchId: target.branch_id ?? null,
    oldValues: null, newValues: { password: '***changed***' },
  })

  return { success: true }
}
