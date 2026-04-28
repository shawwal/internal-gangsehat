'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteInternalUser(targetId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi.' }

  const { data: caller } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'director') return { error: 'Akses ditolak.' }
  if (targetId === user.id) return { error: 'Tidak dapat menghapus akun sendiri.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(targetId)
  if (error) return { error: error.message }
  return { success: true }
}
