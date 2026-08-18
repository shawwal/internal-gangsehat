'use server'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_REMINDER_TEMPLATE, DEFAULT_ORDER_CONFIRMATION_TEMPLATE } from '@/lib/utils'

const KEY_REMINDER      = 'patient_reminder_template'
const KEY_CONFIRMATION  = 'order_confirmation_template'
const KEY_ADMIN_PHONE   = 'admin_primary_phone'

async function fetchConfig(kunci: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('internal_konfigurasi')
    .select('nilai')
    .eq('kunci', kunci)
    .maybeSingle()
  return data?.nilai ?? null
}

async function saveConfig(kunci: string, nilai: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('internal_konfigurasi')
    .upsert({ kunci, nilai, updated_at: new Date().toISOString() }, { onConflict: 'kunci' })
  return { error: error?.message ?? null }
}

export async function fetchReminderTemplate(): Promise<string> {
  return (await fetchConfig(KEY_REMINDER)) ?? DEFAULT_REMINDER_TEMPLATE
}

export async function saveReminderTemplate(nilai: string): Promise<{ error: string | null }> {
  return saveConfig(KEY_REMINDER, nilai)
}

export async function fetchOrderConfirmationTemplate(): Promise<string> {
  return (await fetchConfig(KEY_CONFIRMATION)) ?? DEFAULT_ORDER_CONFIRMATION_TEMPLATE
}

export async function saveOrderConfirmationTemplate(nilai: string): Promise<{ error: string | null }> {
  return saveConfig(KEY_CONFIRMATION, nilai)
}

export async function fetchAdminPhone(): Promise<string> {
  return (await fetchConfig(KEY_ADMIN_PHONE)) ?? ''
}

export async function saveAdminPhone(nilai: string): Promise<{ error: string | null }> {
  return saveConfig(KEY_ADMIN_PHONE, nilai)
}
