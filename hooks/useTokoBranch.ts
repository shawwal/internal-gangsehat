'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const LS_KEY = 'toko:branch'

interface TokoBranchState {
  loading: boolean
  branchId: string | null
  /** Director only (no own branch): every active branch, for the picker. */
  branches: { id: string; name: string }[]
  setBranchId: (id: string) => void
}

/** Branch for the fisioterapi Toko: the caller's own branch, or — for a
 *  director (branch_id NULL) — a picked branch, remembered per browser. */
export function useTokoBranch(): TokoBranchState {
  const [loading, setLoading] = useState(true)
  const [branchId, setBranchIdState] = useState<string | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setLoading(false); return }
      const { data: profile } = await supabase
        .from('internal_profiles').select('branch_id').eq('id', user.id).single()

      if (profile?.branch_id) {
        if (!cancelled) { setBranchIdState(profile.branch_id); setLoading(false) }
        return
      }
      const { data: list } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name')
      if (cancelled) return
      const rows = list ?? []
      let saved: string | null = null
      try { saved = localStorage.getItem(LS_KEY) } catch { /* storage unavailable */ }
      setBranches(rows)
      setBranchIdState(rows.find((b) => b.id === saved)?.id ?? rows[0]?.id ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  function setBranchId(id: string) {
    setBranchIdState(id)
    try { localStorage.setItem(LS_KEY, id) } catch { /* storage unavailable */ }
  }

  return { loading, branchId, branches, setBranchId }
}
