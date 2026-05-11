'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { roleDashboard } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'

type Profile = {
  id: string
  full_name: string
  phone: string | null
  role: UserRole
}

export default function CompleteProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [step, setStep]         = useState(1)
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [isDark, setIsDark]     = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('internal_profiles')
        .select('id, full_name, phone, role')
        .eq('id', user.id)
        .single()

      if (!prof) { router.push('/login'); return }

      // Already completed — go straight to dashboard
      if (prof.full_name && prof.full_name.trim().length >= 2) {
        router.push(roleDashboard(prof.role as UserRole))
        return
      }

      setProfile(prof as Profile)
      setName(prof.full_name ?? '')
      setPhone(prof.phone ?? '')
      setLoading(false)
    }
    init()
  }, [router])

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Nama minimal 2 karakter.')
      return
    }
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('internal_profiles')
      .update({ full_name: trimmed })
      .eq('id', profile!.id)
    setSaving(false)
    if (err) { setError('Gagal menyimpan nama. Coba lagi.'); return }
    setStep(2)
  }

  async function handleStep2(skipPhone = false) {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('internal_profiles')
      .update({ phone: skipPhone ? null : (phone.trim() || null) })
      .eq('id', profile!.id)
    setSaving(false)
    router.push(roleDashboard(profile!.role))
  }

  // Full-screen loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF0090]/10 via-background to-[#FFB35C]/10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Memuat profil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF0090]/10 via-background to-[#FFB35C]/10 px-4">
      <div className="glass-card shadow-2xl p-8 w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src={isDark ? '/white-logo.png' : '/black-logo.png'}
            alt="Gangsehat"
            width={140}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-7">
          {[1, 2].map(n => (
            <div
              key={n}
              className={`h-2 rounded-full transition-all duration-300 bg-primary
                ${step === n ? 'w-6' : step > n ? 'w-2 opacity-60' : 'w-2 opacity-20'}`}
            />
          ))}
        </div>

        {/* Step 1 — Full Name */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-5">
            <div className="text-center">
              <h1 className="text-lg font-bold text-foreground">Selamat Datang! 👋</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Mari lengkapi profil Anda terlebih dahulu
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Langkah 1 dari 2</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                Nama Lengkap
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                placeholder="Masukkan nama lengkap Anda"
                className="w-full px-4 py-3 border border-border rounded-2xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                autoFocus
              />
              {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={saving || name.trim().length < 2}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold
                hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 hover:scale-[1.01]"
            >
              {saving ? 'Menyimpan...' : 'Lanjut →'}
            </button>
          </form>
        )}

        {/* Step 2 — Phone */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-lg font-bold text-foreground">Hampir selesai!</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Nomor telepon membantu tim menghubungi Anda
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Langkah 2 dari 2</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                Nomor Telepon{' '}
                <span className="font-normal normal-case text-muted-foreground">(opsional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Contoh: 08123456789"
                className="w-full px-4 py-3 border border-border rounded-2xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleStep2(true)}
                disabled={saving}
                className="py-3 rounded-2xl border border-border text-sm font-medium text-muted-foreground
                  hover:bg-muted disabled:opacity-50 transition-all duration-200"
              >
                Lewati
              </button>
              <button
                onClick={() => handleStep2(false)}
                disabled={saving}
                className="py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold
                  hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 hover:scale-[1.01]"
              >
                {saving ? 'Menyimpan...' : 'Selesai & Masuk →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
