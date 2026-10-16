// Server-side only (service role + decryption) — import from server actions.
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPatientPII } from '@/lib/encryption'

/** Decrypted patient names for drill-down lists (service role; callers check access first). */
export async function resolvePatientNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))]
  const out = new Map<string, string>()
  const admin = createAdminClient()
  for (let i = 0; i < unique.length; i += 300) {
    const { data } = await admin.from('patients').select('id, encrypted_name').in('id', unique.slice(i, i + 300))
    for (const p of data ?? []) {
      try {
        out.set(p.id, decryptPatientPII({ encrypted_name: p.encrypted_name ?? '', encrypted_phone: '' }).name || '—')
      } catch {
        out.set(p.id, '—')
      }
    }
  }
  return out
}
