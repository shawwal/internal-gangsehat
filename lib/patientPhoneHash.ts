import { createAdminClient } from '@/lib/supabase/admin'
import { hashPhone } from '@/lib/encryption'

/**
 * phone_hash has a UNIQUE index, but siblings (e.g. Griya Anak children) share a
 * parent's number. Return the hash only when no other patient owns it; otherwise
 * null so the row still saves (the real phone stays in encrypted_phone).
 *
 * Lives outside app/actions so it isn't exposed as a callable server action.
 */
export async function phoneHashIfFree(phone: string, excludeId?: string): Promise<string | null> {
  const hash = hashPhone(phone)
  let q = createAdminClient().from('patients').select('id').eq('phone_hash', hash).limit(1)
  if (excludeId) q = q.neq('id', excludeId)
  const { data } = await q
  return data && data.length > 0 ? null : hash
}
