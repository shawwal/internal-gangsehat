'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusMessage } from './StatusMessage'
import type { StatusState } from './types'

interface PwForm {
  next: string
  confirm: string
}

interface ShowState {
  next: boolean
  confirm: boolean
}

const FIELDS: { key: keyof PwForm; label: string; placeholder: string }[] = [
  { key: 'next',    label: 'Kata Sandi Baru',    placeholder: 'Minimal 6 karakter' },
  { key: 'confirm', label: 'Konfirmasi Kata Sandi', placeholder: 'Ulangi kata sandi baru' },
]

export function PasswordCard() {
  const [form, setForm]     = useState<PwForm>({ next: '', confirm: '' })
  const [show, setShow]     = useState<ShowState>({ next: false, confirm: false })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)

  function flash(message: string, ok: boolean) {
    setStatus({ message, ok })
    setTimeout(() => setStatus(null), 4000)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()

    if (form.next !== form.confirm) {
      flash('Konfirmasi kata sandi tidak cocok.', false)
      return
    }
    if (form.next.length < 6) {
      flash('Kata sandi minimal 6 karakter.', false)
      return
    }

    setSaving(true)
    const { error } = await createClient().auth.updateUser({ password: form.next })
    setSaving(false)

    if (error) {
      flash('Gagal mengubah kata sandi.', false)
    } else {
      flash('Kata sandi berhasil diubah.', true)
      setForm({ next: '', confirm: '' })
      setShow({ next: false, confirm: false })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label htmlFor={`pw-${key}`} className="block text-xs font-medium text-foreground mb-1">
            {label}
          </label>
          <div className="relative">
            <input
              id={`pw-${key}`}
              type={show[key] ? 'text' : 'password'}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              required
              className="w-full px-3 py-2 pr-10 border border-border rounded-xl text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
            <button
              type="button"
              aria-label={show[key] ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
              onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg hover:bg-muted"
            >
              {show[key] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      ))}

      <StatusMessage status={status} />

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 min-h-[36px] rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {saving ? 'Menyimpan...' : 'Ubah Kata Sandi'}
      </button>
    </form>
  )
}
