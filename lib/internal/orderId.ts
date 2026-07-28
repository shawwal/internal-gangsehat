import type { SupabaseClient } from '@supabase/supabase-js'
import { formatTrxCode } from './formatters'

/** Generates the next global, monthly-reset order ID (e.g. TRX/2026/07/0348). Server-only. */
export async function generateOrderId(supabase: SupabaseClient): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: seq, error } = await supabase.rpc('next_order_seq', {
    p_year: year,
    p_month: month,
  })
  if (error || seq == null) throw new Error(error?.message ?? 'Gagal membuat order ID')

  return formatTrxCode(year, month, seq as number)
}
