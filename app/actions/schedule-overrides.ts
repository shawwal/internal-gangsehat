'use server'

import { createClient } from '@/lib/supabase/server'

export interface ScheduleOverride {
  id: string
  staff_id: string
  branch_id: string | null
  start_date: string
  end_date: string
  hari: string
  shift: string
  jam_mulai: string
  jam_selesai: string
  reason: string | null
  status: string
  created_at: string
}

export async function fetchActiveOverrides(staffId: string): Promise<ScheduleOverride[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('schedule_overrides')
    .select('id, staff_id, branch_id, start_date, end_date, hari, shift, jam_mulai, jam_selesai, reason, status, created_at')
    .eq('staff_id', staffId)
    .eq('status', 'active')
    .order('start_date', { ascending: true })
  return (data ?? []) as ScheduleOverride[]
}

export async function createScheduleOverride(input: {
  staff_id: string
  branch_id: string | null
  start_date: string
  end_date: string
  hari: string
  shift: 'PAGI' | 'SORE'
  jam_mulai: string
  jam_selesai: string
  reason?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Tidak terautentikasi' }

  const { error } = await supabase.from('schedule_overrides').insert({
    ...input,
    reason:     input.reason?.trim() || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  return {}
}

export async function cancelScheduleOverride(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('schedule_overrides')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}
