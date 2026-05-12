'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (fullName.trim().length < 2) {
      setError('Nama lengkap minimal 2 karakter.')
      return
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    // If session is returned, email confirmation is disabled — go to /pending
    if (data.session) {
      window.location.href = '/pending'
      return
    }

    // Email confirmation required — show success message
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center space-y-4">
            <div className="flex justify-center mb-2">
              <Image src="/black-logo.png" alt="Gang Sehat" width={140} height={40} className="object-contain dark:hidden" priority />
              <Image src="/white-logo.png" alt="Gang Sehat" width={140} height={40} className="object-contain hidden dark:block" priority />
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">Pendaftaran Berhasil!</h2>
            <p className="text-sm text-muted-foreground">
              Periksa email <span className="font-medium text-foreground">{email}</span> dan klik tautan konfirmasi untuk mengaktifkan akun Anda.
            </p>
            <Link
              href="/login"
              className="block w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-center text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
            >
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image src="/black-logo.png" alt="Gang Sehat" width={180} height={52} className="object-contain dark:hidden" priority />
              <Image src="/white-logo.png" alt="Gang Sehat" width={180} height={52} className="object-contain hidden dark:block" priority />
            </div>
            <p className="text-sm text-muted-foreground">Daftar sebagai tim internal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap Anda"
                required
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email Anda"
                required
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Kata Sandi</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  required
                  className="w-full px-3 py-2.5 pr-10 border border-border rounded-xl text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Konfirmasi Kata Sandi</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  required
                  className="w-full px-3 py-2.5 pr-10 border border-border rounded-xl text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? 'Sembunyikan konfirmasi' : 'Tampilkan konfirmasi'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Mendaftar...' : 'Daftar'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
