'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CategoryKey } from '@/components/targetProgress/types'

export type DisabledCategoryMap = Record<string, Set<CategoryKey>>

export function useBranchCategorySettings(branchIds: string[]) {
  const [disabled, setDisabled] = useState<DisabledCategoryMap>({})
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (branchIds.length === 0) { setDisabled({}); setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('branch_target_category_settings')
      .select('branch_id, category')
      .in('branch_id', branchIds)
    if (error) console.error('[useBranchCategorySettings] load error:', error)
    const map: DisabledCategoryMap = {}
    for (const row of (data ?? []) as { branch_id: string; category: CategoryKey }[]) {
      if (!map[row.branch_id]) map[row.branch_id] = new Set()
      map[row.branch_id].add(row.category)
    }
    setDisabled(map)
    setLoading(false)
  }, [branchIds])

  useEffect(() => { load() }, [load])

  const toggle = useCallback(async (branchId: string, category: CategoryKey, enable: boolean) => {
    setDisabled(prev => {
      const next = { ...prev }
      const set = new Set(next[branchId] ?? [])
      if (enable) set.delete(category); else set.add(category)
      next[branchId] = set
      return next
    })

    const supabase = createClient()
    if (enable) {
      const { error } = await supabase
        .from('branch_target_category_settings')
        .delete()
        .eq('branch_id', branchId)
        .eq('category', category)
      if (error) console.error('[useBranchCategorySettings] enable error:', error)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('branch_target_category_settings')
        .upsert(
          { branch_id: branchId, category, updated_by: user?.id, updated_at: new Date().toISOString() },
          { onConflict: 'branch_id,category' },
        )
      if (error) console.error('[useBranchCategorySettings] disable error:', error)
    }
  }, [])

  return { disabled, loading, toggle, reload: load }
}
