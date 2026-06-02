'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusMessage } from './StatusMessage'
import type { SettingsProfile, StatusState } from './types'

interface Props {
  initialData: Pick<SettingsProfile, 'id' | 'full_name' | 'phone' | 'avatar_url'>
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

export function ProfileCard({ initialData }: Props) {
  const [fullName, setFullName]   = useState(initialData.full_name)
  const [phone, setPhone]         = useState(initialData.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatar_url)
  const [preview, setPreview]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [status, setStatus]       = useState<StatusState | null>(null)
  const fileRef                   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  function flash(message: string, ok: boolean) {
    setStatus({ message, ok })
    setTimeout(() => setStatus(null), 4000)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      flash('File harus berupa gambar.', false); return
    }
    if (file.size > MAX_SIZE_BYTES) {
      flash('Ukuran gambar maksimal 2 MB.', false); return
    }

    if (preview) URL.revokeObjectURL(preview)
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    const path = `avatars/${user.id}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      flash('Gagal mengunggah foto.', false)
      URL.revokeObjectURL(objectUrl)
      setPreview(null)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('internal_profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    if (updateError) {
      flash('Foto diunggah, gagal menyimpan URL.', false)
    } else {
      setAvatarUrl(publicUrl)
      flash('Foto profil diperbarui.', true)
    }

    URL.revokeObjectURL(objectUrl)
    setPreview(null)
    setUploading(false)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase
      .from('internal_profiles')
      .update({ full_name: fullName, phone: phone || null })
      .eq('id', user.id)

    setSaving(false)
    flash(error ? 'Gagal menyimpan.' : 'Profil berhasil diperbarui.', !error)
  }

  const displaySrc = preview ?? avatarUrl
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

  return (
    // Desktop: avatar left, form right. Mobile: stacked.
    <div className="flex flex-col sm:flex-row gap-6">

      {/* Avatar column */}
      <div className="flex sm:flex-col items-center sm:items-center gap-4 sm:gap-3 sm:w-36 shrink-0">
        <button
          type="button"
          aria-label="Ganti foto profil"
          onClick={() => fileRef.current?.click()}
          className="relative w-20 h-20 rounded-full shrink-0 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc}
              alt="Foto profil"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
              {initials}
            </div>
          )}

          {uploading ? (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 size={20} className="text-white animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <Camera size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
          aria-hidden="true"
          tabIndex={-1}
        />

        <div className="sm:text-center">
          <p className="text-sm font-medium text-foreground leading-tight">Foto Profil</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            JPG, PNG, WebP.<br className="hidden sm:block" /> Maks 2 MB.
          </p>
        </div>
      </div>

      {/* Divider — vertical on desktop, horizontal on mobile */}
      <div className="hidden sm:block w-px bg-border shrink-0" />
      <div className="block sm:hidden h-px bg-border" />

      {/* Form column */}
      <form onSubmit={handleSubmit} className="flex-1 space-y-3 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="full_name" className="block text-xs font-medium text-foreground mb-1">
              Nama Lengkap
            </label>
            <input
              id="full_name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-foreground mb-1">
              No. Telepon
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opsional"
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </div>
        </div>

        <StatusMessage status={status} />

        <button
          type="submit"
          disabled={saving || uploading}
          className="px-4 py-2 min-h-[36px] rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>
    </div>
  )
}
