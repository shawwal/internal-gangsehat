'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGriyaBranchContext } from '@/components/griya/GriyaBranchProvider'

interface GriyaBranchState {
  loading: boolean
  branchId: string | null
  role: string | null
  enabled: boolean          // feature gate for the caller's branch
  canEdit: boolean
}

/** Shared resolver for the Griya Anak pages — role, branch, and feature gate.
 *  Under /griya-anak it reads the branch picked in the Griya layout
 *  (GriyaBranchProvider); elsewhere it resolves the caller's own branch. */
export function useGriyaBranch(): GriyaBranchState {
  const ctx = useGriyaBranchContext()
  const [state, setState] = useState<GriyaBranchState>({
    loading: true, branchId: null, role: null, enabled: false, canEdit: false,
  })

  useEffect(() => {
    if (ctx) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setState((s) => ({ ...s, loading: false })); return }

      const { data: profile } = await supabase
        .from('internal_profiles').select('role, branch_id').eq('id', user.id).single()
      const role = profile?.role ?? null

      let branchId = profile?.branch_id ?? null
      if (!branchId) {
        const { data: b } = await supabase
          .from('branches').select('id').ilike('name', '%Griya Anak%').eq('is_active', true).limit(1).maybeSingle()
        branchId = b?.id ?? null
      }

      let enabled = role === 'director'
      if (!enabled && branchId) {
        const { data: s } = await supabase
          .from('branch_griya_settings').select('enabled').eq('branch_id', branchId).maybeSingle()
        enabled = s?.enabled ?? false
      }

      if (!cancelled) {
        setState({
          loading: false,
          branchId,
          role,
          enabled,
          canEdit: !!role && ['director', 'manager', 'admin'].includes(role),
        })
      }
    })()
    return () => { cancelled = true }
  }, [ctx])

  if (ctx) {
    return { loading: false, branchId: ctx.branchId, role: ctx.role, enabled: ctx.enabled, canEdit: ctx.canEdit }
  }
  return state
}
