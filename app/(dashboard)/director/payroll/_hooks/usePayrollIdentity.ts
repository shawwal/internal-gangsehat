import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SalarySetting } from '@/components/salary/types'

export interface PayrollIdentity {
  role: string | null
  userId: string | null
  isManager: boolean
  myBranchId: string | null
  myBranchName: string | null
  branches: { id: string; name: string }[]
  settings: SalarySetting[]
  setSettings: (s: SalarySetting[]) => void
}

export function usePayrollIdentity(): PayrollIdentity {
  const [role, setRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [myBranchId, setMyBranchId] = useState<string | null>(null)
  const [myBranchName, setMyBranchName] = useState<string | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [settings, setSettings] = useState<SalarySetting[]>([])

  useEffect(() => {
    async function bootstrap() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('role, branch_id, branches(name)')
        .eq('id', user.id)
        .single()

      if (!profile) return
      setRole(profile.role)
      const mgr = profile.role === 'manager'
      setIsManager(mgr)
      setMyBranchId(profile.branch_id ?? null)
      setMyBranchName((profile as any).branches?.name ?? null)

      if (!mgr) {
        const { data: bData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
        setBranches(bData ?? [])
      }

      const { data: sData } = await supabase
        .from('salary_settings')
        .select('*')
        .order('role')
      setSettings((sData ?? []) as SalarySetting[])
    }

    bootstrap()
  }, [])

  return { role, userId, isManager, myBranchId, myBranchName, branches, settings, setSettings }
}
