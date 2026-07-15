'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { roleDashboard } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'

export default function PendingPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/login'); return }

      // If director has already assigned a real role, redirect to their dashboard
      if (profile.role !== 'non-staff') {
        router.push(roleDashboard(profile.role as UserRole))
        return
      }

      setFullName(profile.full_name || '')
      setEmail(profile.email || user.email || '')
      setLoading(false)
    }
    init()
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center space-y-6">
          <div className="flex justify-center">
            <Image src="/black-logo.png" alt="Gang Sehat" width={140} height={40} className="object-contain dark:hidden" priority />
            <Image src="/white-logo.png" alt="Gang Sehat" width={140} height={40} className="object-contain hidden dark:block" priority />
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-secondary/20 flex items-center justify-center">
              <Clock className="w-7 h-7 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Menunggu Konfirmasi Peran</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Halo, <span className="font-medium text-foreground">{fullName || email}</span>
              </p>
            </div>
          </div>

          <div className="bg-muted rounded-xl px-4 py-3 text-sm text-muted-foreground text-left space-y-1">
            <p>Akun Anda telah berhasil dibuat.</p>
            <p>Direktur akan segera menetapkan peran dan akses Anda ke sistem.</p>
            <p className="pt-1 text-xs">Email: <span className="font-medium text-foreground">{email}</span></p>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}
