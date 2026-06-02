'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const INPUT_CLS =
  'w-full px-4 py-3 border border-border rounded-2xl text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError('Email atau kata sandi tidak valid.')
        setLoading(false)
        return
      }

      // Full reload so middleware picks up the new session cookies and redirects to role home
      window.location.href = '/dashboard'
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        setError('Gagal masuk dengan Google. Coba lagi.')
        setGoogleLoading(false)
      }
      // On success, browser is redirected by Supabase — no manual action needed
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
      setGoogleLoading(false)
    }
  }

  const busy = loading || googleLoading

  return (
    <div className="bg-card rounded-3xl shadow-md border border-border p-8">
      <div className="mb-7">
        <h2 className="text-xl font-bold text-foreground">Selamat Datang</h2>
        <p className="text-sm text-muted-foreground mt-1">Masuk ke akun Anda untuk melanjutkan</p>
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
            className={INPUT_CLS}
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
              className={`${INPUT_CLS} pr-12`}
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
          <div role="alert" className="flex items-start gap-2.5 text-sm text-destructive bg-destructive/10 rounded-2xl px-4 py-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 px-4 rounded-2xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-[48px] shadow-sm"
          style={{ boxShadow: '0 4px 14px 0 rgba(255,0,144,0.25)' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              Sedang masuk...
            </span>
          ) : 'Masuk'}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">atau lanjutkan dengan</span>
        </div>
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-sm font-medium border border-border bg-background text-foreground hover:bg-muted active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-[48px]"
      >
        {googleLoading ? <Spinner /> : <GoogleIcon />}
        <span>Masuk dengan Google</span>
      </button>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Belum punya akun?{' '}
        <Link href="/register" className="text-primary font-semibold hover:underline underline-offset-2 transition-colors">
          Daftar
        </Link>
      </p>
    </div>
  )
}
