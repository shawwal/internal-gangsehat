'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
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
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F4F5F7' }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div
              className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: '#3D2B1F' }}
            >
              <span className="text-[#D4A017] font-bold text-lg" style={{ fontFamily: 'Sora, sans-serif' }}>T</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>
              TeamFGS
            </h1>
            <p className="text-sm text-gray-500 mt-1">Sistem Internal Manajemen Fisioterapi</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email Anda"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kata Sandi</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi Anda"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#D4A017' }}
            >
              {loading ? 'Sedang masuk...' : 'Masuk'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Dikembangkan dengan ❤ oleh BAT Solution
          </p>
        </div>
      </div>
    </div>
  )
}
