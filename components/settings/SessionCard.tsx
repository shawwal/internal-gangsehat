'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function SessionCard() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    setLoading(true)
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">Sesi Aktif</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Keluar dari semua perangkat yang terhubung.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 min-h-[36px] rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive hover:text-white disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
      >
        <LogOut size={14} />
        {loading ? 'Keluar...' : 'Keluar'}
      </button>
    </div>
  )
}
