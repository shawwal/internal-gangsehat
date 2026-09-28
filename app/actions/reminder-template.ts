'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_REMINDER_TEMPLATE, DEFAULT_ORDER_CONFIRMATION_TEMPLATE } from '@/lib/utils'

const KEY_REMINDER      = 'patient_reminder_template'
const KEY_CONFIRMATION  = 'order_confirmation_template'
const KEY_ADMIN_PHONE   = 'admin_primary_phone'

export type WaConfigKind = 'reminder' | 'confirmation' | 'phone'

const KEYS: Record<WaConfigKind, string> = {
  reminder: KEY_REMINDER,
  confirmation: KEY_CONFIRMATION,
  phone: KEY_ADMIN_PHONE,
}

const DEFAULTS: Record<WaConfigKind, string> = {
  reminder: DEFAULT_REMINDER_TEMPLATE,
  confirmation: DEFAULT_ORDER_CONFIRMATION_TEMPLATE,
  phone: '',
}

// Per-branch overrides live in the same internal_konfigurasi table under
// `<key>:<branchId>`. A branch without an override falls back to the global
// key, then to the built-in default.
const branchKey = (kunci: string, branchId: string) => `${kunci}:${branchId}`

export interface WaConfigSet { reminder: string; confirmation: string; phone: string }

export interface WaConfigAll {
  global: WaConfigSet
  /** only the values a branch actually overrides */
  byBranch: Record<string, Partial<WaConfigSet>>
}

/** Every WA template/phone value — global plus all per-branch overrides — in one query. */
export async function fetchWaConfigAll(): Promise<WaConfigAll> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_konfigurasi')
    .select('kunci, nilai')   // small key-value table — filtered below

  const global: WaConfigSet = { ...DEFAULTS }
  const byBranch: WaConfigAll['byBranch'] = {}
  for (const row of data ?? []) {
    for (const kind of Object.keys(KEYS) as WaConfigKind[]) {
      const k = KEYS[kind]
      if (row.kunci === k) global[kind] = row.nilai
      else if (row.kunci.startsWith(k + ':')) {
        const b = row.kunci.slice(k.length + 1)
        ;(byBranch[b] ??= {})[kind] = row.nilai
      }
    }
  }
  return { global, byBranch }
}

// Who may edit which WA config:
//   director        — the global default and every branch
//   admin / manager — only their own branch's override
// Checked here, then written with the service-role client, so the rule doesn't
// depend on internal_konfigurasi's table-wide RLS.
async function authorizeWrite(branchId: string | null): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }
  const { data: profile } = await supabase
    .from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
  if (profile?.role === 'director') return { ok: true }
  if (profile?.role !== 'admin' && profile?.role !== 'manager') return { error: 'Tidak memiliki akses' }
  if (!branchId || branchId !== profile.branch_id) return { error: 'Hanya bisa mengubah template cabang sendiri' }
  return { ok: true }
}

/** Save a value globally (branchId null) or as a branch override. */
export async function saveWaConfig(kind: WaConfigKind, nilai: string, branchId: string | null): Promise<{ error: string | null }> {
  const auth = await authorizeWrite(branchId)
  if ('error' in auth) return { error: auth.error }
  const kunci = branchId ? branchKey(KEYS[kind], branchId) : KEYS[kind]
  const { error } = await createAdminClient()
    .from('internal_konfigurasi')
    .upsert({ kunci, nilai, updated_at: new Date().toISOString() }, { onConflict: 'kunci' })
  return { error: error?.message ?? null }
}

/** Remove a branch override so the branch follows the global value again. */
export async function clearWaConfigOverride(kind: WaConfigKind, branchId: string): Promise<{ error: string | null }> {
  const auth = await authorizeWrite(branchId)
  if ('error' in auth) return { error: auth.error }
  const { error } = await createAdminClient()
    .from('internal_konfigurasi')
    .delete()
    .eq('kunci', branchKey(KEYS[kind], branchId))
  return { error: error?.message ?? null }
}
