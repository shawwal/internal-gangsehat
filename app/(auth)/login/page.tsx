'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Sun, Moon, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function useTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('gs_theme')
    setIsDark(
      stored === 'dark' || document.documentElement.classList.contains('dark')
    )
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('gs_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('gs_theme', 'light')
    }
  }

  return { isDark, toggle }
}

const FEATURES = ['Multi-Cabang', 'Laporan Keuangan', 'Manajemen SDM', 'Marketing']

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { isDark, toggle } = useTheme()
  const router = useRouter()

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email atau kata sandi tidak valid.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">

      {/* Theme toggle — fixed top-right, always visible */}
      <button
        onClick={toggle}
        aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
        className="fixed top-4 right-4 z-50 w-11 h-11 flex items-center justify-center rounded-2xl bg-card border border-border shadow-sm text-foreground hover:bg-muted transition-colors duration-200 cursor-pointer"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* ── LEFT BRAND PANEL — desktop only ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF0090] via-[#ff3da5] to-[#FFB35C]" />

        {/* Decorative blobs */}
        <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-float motion-reduce:animate-none" />
        <div
          className="absolute -bottom-10 -right-10 w-96 h-96 rounded-full bg-[#FFB35C]/25 blur-3xl animate-float motion-reduce:animate-none"
          style={{ animationDelay: '1.5s' }}
        />
        <div className="absolute top-1/3 left-1/2 w-56 h-56 rounded-full bg-white/5 blur-2xl" />

        {/* Brand content */}
        <div className="relative z-10 text-center text-white max-w-xs">
          <div className="flex justify-center mb-10">
            <Image
              src="/white-logo.png"
              alt="Gang Sehat"
              width={200}
              height={58}
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>

          <h1 className="text-3xl font-bold leading-tight mb-4">
            Sistem Manajemen<br />Internal Klinik
          </h1>
          <p className="text-white/75 text-sm leading-relaxed">
            Platform terpadu untuk manajemen cabang, laporan keuangan, HR, dan pemasaran Gangsehat.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-8">
            {FEATURES.map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-xs font-medium border border-white/20"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT / MAIN FORM PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12 relative">

        {/* Mobile-only background blobs */}
        <div className="absolute inset-0 lg:hidden overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#FF0090]/8 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#FFB35C]/8 blur-3xl" />
        </div>

        <div className="w-full max-w-sm relative z-10">

          {/* Mobile / tablet logo — hidden on desktop (shown on left panel) */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Image
              src="/black-logo.png"
              alt="Gang Sehat"
              width={160}
              height={46}
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/white-logo.png"
              alt="Gang Sehat"
              width={160}
              height={46}
              className="object-contain hidden dark:block"
              priority
            />
          </div>

          {/* Form card */}
          <div className="bg-card rounded-3xl shadow-md border border-border p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-foreground">Selamat Datang</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Masuk ke akun Anda untuk melanjutkan
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@gangsehat.com"
                  required
                  className="w-full px-4 py-3 border border-border rounded-2xl text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Anda"
                    required
                    className="w-full px-4 py-3 pr-12 border border-border rounded-2xl text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 rounded-2xl px-4 py-3"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-[48px] shadow-sm"
                style={{ boxShadow: '0 4px 14px 0 rgba(255,0,144,0.25)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sedang masuk...
                  </span>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Belum punya akun?{' '}
              <Link href="/register" className="text-primary font-semibold hover:underline underline-offset-2 transition-colors">
                Daftar
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-5">
            © 2026 Gang Sehat. Semua hak dilindungi
          </p>
        </div>
      </div>
    </div>
  )
}
