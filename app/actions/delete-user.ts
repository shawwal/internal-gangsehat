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

  // Staff accounts accumulate references from patient visits, transactions,
  // attendance, leave requests, payroll, etc. Hard-deleting the auth user
  // fails at the DB level once any of those exist, so we deactivate instead
  // of destroying the account and its history.
  const admin = createAdminClient()

  const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
    ban_duration: '876000h', // ~100 years — effectively permanent
  })
  if (banError) return { error: banError.message }

  const { error: profileError } = await admin
    .from('internal_profiles')
    .update({ is_active: false })
    .eq('id', targetId)
  if (profileError) return { error: profileError.message }

  return { success: true }
}

/** Tables that hold records *owned* by the staff member — deleted outright. */
const OWNED_TABLES = [
  { table: 'attendance', column: 'staff_id' },
  { table: 'leave_requests', column: 'staff_id' },
  { table: 'staff_targets', column: 'staff_id' },
  { table: 'schedules', column: 'staff_id' },
  { table: 'schedule_overrides', column: 'staff_id' },
  { table: 'employee_salaries', column: 'staff_id' },
  { table: 'payroll_records', column: 'staff_id' },
  { table: 'user_notifications', column: 'user_id' },
] as const

/** Audit-only columns referencing the staff member on records that belong to
 *  someone/something else (a branch, a transaction, another staff's leave
 *  request) — nulled out instead of deleting the parent record. */
const AUDIT_COLUMNS = [
  { table: 'patient_visits', column: 'attending_staff_id' },
  { table: 'transactions', column: 'recorded_by' },
  { table: 'transactions', column: 'confirmed_by' },
  { table: 'transactions', column: 'fisio_id' },
  { table: 'branch_financial_reports', column: 'submitted_by' },
  { table: 'branch_financial_reports', column: 'reviewed_by' },
  { table: 'leave_requests', column: 'reviewed_by' },
  { table: 'staff_targets', column: 'reviewed_by' },
  { table: 'campaigns', column: 'created_by' },
  { table: 'branch_targets', column: 'set_by' },
  { table: 'branch_targets', column: 'reviewed_by' },
  { table: 'salary_settings', column: 'updated_by' },
  { table: 'employee_salaries', column: 'updated_by' },
  { table: 'payroll_records', column: 'confirmed_by' },
  { table: 'payroll_records', column: 'created_by' },
  { table: 'patient_packages', column: 'created_by' },
  { table: 'booking_payments', column: 'created_by' },
  { table: 'schedule_overrides', column: 'created_by' },
] as const

/** Extract the storage object path from a Supabase public URL for the leave-proofs bucket. */
function proofStoragePath(url: string): string | null {
  const marker = '/leave-proofs/'
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

/**
 * Permanently erases a deactivated staff member and every record they own
 * (attendance, leave requests, targets, schedules, salary, payroll,
 * notifications). Audit-only references on shared records (who recorded a
 * transaction, who reviewed someone else's leave, etc.) are nulled instead
 * of deleting those records, since that data belongs to the branch/patient,
 * not the staff member. Irreversible — only allowed on already-deactivated
 * accounts.
 */
export async function permanentlyDeleteUser(targetId: string) {
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

  const { data: target } = await admin
    .from('internal_profiles')
    .select('is_active')
    .eq('id', targetId)
    .single()

  if (!target) return { error: 'Pengguna tidak ditemukan.' }
  if (target.is_active) return { error: 'Nonaktifkan pengguna terlebih dahulu sebelum menghapus permanen.' }

  const { data: proofRows } = await admin
    .from('leave_requests')
    .select('proof_url')
    .eq('staff_id', targetId)
    .not('proof_url', 'is', null)

  const proofPaths = (proofRows ?? [])
    .map((r) => (r.proof_url ? proofStoragePath(r.proof_url) : null))
    .filter(Boolean) as string[]

  if (proofPaths.length > 0) {
    await admin.storage.from('leave-proofs').remove(proofPaths)
  }

  for (const { table, column } of OWNED_TABLES) {
    const { error } = await admin.from(table).delete().eq(column, targetId)
    if (error) return { error: `Gagal menghapus data ${table}: ${error.message}` }
  }

  for (const { table, column } of AUDIT_COLUMNS) {
    const { error } = await admin.from(table).update({ [column]: null }).eq(column, targetId)
    if (error) return { error: `Gagal membersihkan referensi ${table}.${column}: ${error.message}` }
  }

  const { error: profileError } = await admin
    .from('internal_profiles')
    .delete()
    .eq('id', targetId)
  if (profileError) return { error: profileError.message }

  const { error: authError } = await admin.auth.admin.deleteUser(targetId)
  if (authError) return { error: authError.message }

  return { success: true }
}
