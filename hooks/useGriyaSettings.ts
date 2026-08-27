'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type GriyaEnabledMap = Record<string, boolean>

export function useGriyaSettings(branchIds: string[]) {
  const [enabledMap, setEnabledMap] = useState<GriyaEnabledMap>({})
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    if (branchIds.length === 0) { setEnabledMap({}); setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('branch_griya_settings')
      .select('branch_id, enabled')
      .in('branch_id', branchIds)
    if (error) console.error('[useGriyaSettings] load error:', error)
    const map: GriyaEnabledMap = {}
    for (const row of (data ?? []) as { branch_id: string; enabled: boolean }[]) {
      map[row.branch_id] = row.enabled
    }
    setEnabledMap(map)
    setLoading(false)
  }, [branchIds])

  useEffect(() => { load() }, [load])

  const toggle = useCallback(async (branchId: string, enabled: boolean) => {
    const prevValue = enabledMap[branchId] ?? false
    setEnabledMap(prev => ({ ...prev, [branchId]: enabled }))

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('branch_griya_settings')
      .upsert(
        { branch_id: branchId, enabled, updated_by: user?.id, updated_at: new Date().toISOString() },
        { onConflict: 'branch_id' },
      )
    if (error) {
      console.error('[useGriyaSettings] toggle error:', error)
      setEnabledMap(prev => ({ ...prev, [branchId]: prevValue }))
    }
  }, [enabledMap])

  return { enabledMap, loading, toggle, reload: load }
}
