'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SettingsProfile } from './types'

interface UseSettingsProfileReturn {
  profile: SettingsProfile | null
  loading: boolean
  refetch: () => Promise<void>
}

export function useSettingsProfile(): UseSettingsProfileReturn {
  const [profile, setProfile] = useState<SettingsProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('internal_profiles')
      .select('id, full_name, phone, email, role, branch_id, avatar_url, branches(name)')
      .eq('id', user.id)
      .single()

    if (data) {
      const branch = data.branches as unknown as { name: string } | null
      setProfile({
        id:          data.id,
        full_name:   data.full_name ?? '',
        phone:       data.phone ?? null,
        email:       data.email ?? user.email ?? '',
        role:        data.role,
        branch_id:   data.branch_id ?? null,
        branch_name: branch?.name ?? null,
        avatar_url:  data.avatar_url ?? null,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { profile, loading, refetch: load }
}
