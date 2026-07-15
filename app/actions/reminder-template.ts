'use server'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_REMINDER_TEMPLATE } from '@/lib/utils'

const CONFIG_KEY = 'patient_reminder_template'

export async function fetchReminderTemplate(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_konfigurasi')
    .select('nilai')
    .eq('kunci', CONFIG_KEY)
    .maybeSingle()
  return data?.nilai ?? DEFAULT_REMINDER_TEMPLATE
}

export async function saveReminderTemplate(nilai: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_konfigurasi')
    .upsert({ kunci: CONFIG_KEY, nilai, updated_at: new Date().toISOString() }, { onConflict: 'kunci' })
  return { error: error?.message ?? null }
}
