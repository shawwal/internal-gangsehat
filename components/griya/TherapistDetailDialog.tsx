'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Phone, Mail, Building2, BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DISCIPLINE_LABEL, DISCIPLINE_COLOR } from './constants'
import type { GriyaTherapist } from '@/app/actions/griyaJadwal'

interface ExtraProfile {
  email: string | null
  phone: string | null
  role: string
  avatar_url: string | null
  branches: { name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  director: 'Direktur', manager: 'Manager', admin: 'Admin',
  staff: 'Staff', therapist: 'Terapis',
}

interface Props {
  therapist: GriyaTherapist
  onClose: () => void
}

export function TherapistDetailDialog({ therapist, onClose }: Props) {
  const [profile, setProfile] = useState<ExtraProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    createClient()
      .from('internal_profiles')
      .select('email, phone, role, avatar_url, branches(name)')
      .eq('id', therapist.therapist_id)
      .single()
      .then(({ data }) => {
        setProfile(data as unknown as ExtraProfile | null)
        setLoading(false)
      })
  }, [therapist.therapist_id])

  const displayName = therapist.nickname || therapist.full_name
  const avatarUrl = profile?.avatar_url ?? therapist.avatar_url
  const showImg = !!avatarUrl && !imgError
  const dc = DISCIPLINE_COLOR[therapist.discipline]
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-3xl border border-border w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header strip in discipline color */}
        <div className={`relative px-6 pt-10 pb-8 flex flex-col items-center text-center gap-3 ${dc?.band ?? 'bg-muted'}`}>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="absolute top-3 right-3 p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="w-36 h-36 rounded-full border-4 border-white/50 overflow-hidden shrink-0 shadow-lg">
            {showImg ? (
              <img
                src={avatarUrl!}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center text-5xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-white font-bold text-2xl leading-tight truncate">{displayName}</p>
            {therapist.nickname && therapist.nickname !== therapist.full_name && (
              <p className="text-white/70 text-sm truncate">{therapist.full_name}</p>
            )}
            <span className="mt-2 inline-block text-xs px-3 py-1 rounded-full bg-white/20 text-white font-bold uppercase tracking-wide">
              {DISCIPLINE_LABEL[therapist.discipline]}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Memuat...
            </div>
          ) : (
            <>
              {profile?.role && (
                <div className="flex items-center gap-3 text-base">
                  <BadgeCheck size={18} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">{ROLE_LABELS[profile.role] ?? profile.role}</span>
                </div>
              )}
              {profile?.email && (
                <div className="flex items-center gap-3 text-base">
                  <Mail size={18} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground truncate">{profile.email}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-3 text-base">
                  <Phone size={18} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">{profile.phone}</span>
                </div>
              )}
              {profile?.branches?.name && (
                <div className="flex items-center gap-3 text-base">
                  <Building2 size={18} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">{profile.branches.name}</span>
                </div>
              )}
              {!profile?.email && !profile?.phone && !profile?.branches?.name && (
                <p className="text-sm text-muted-foreground">Tidak ada info tambahan.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
