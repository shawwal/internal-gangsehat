'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Profile } from '@/types'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!user) { setProfile(null); return }
    createClient()
      .from('profiles')
      .select('id, email, full_name, phone, role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [user?.id])

  return profile
}
