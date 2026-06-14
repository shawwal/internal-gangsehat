'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Phone, Mail, Building2, BadgeCheck, CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ScheduleOverrideDialog } from './ScheduleOverrideDialog'
import type { DayStaffEntry } from './types'

interface StaffProfile {
  full_name: string
  nickname: string | null
  email: string
  phone: string | null
  role: string
  avatar_url: string | null
  branches: { name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  director:  'Direktur',
  finance:   'Keuangan',
  hr:        'HR',
  marketing: 'Marketing',
  staff:     'Staff',
  therapist: 'Terapis',
  manager:   'Manager',
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0] ?? '').join('').toUpperCase()
}

interface Props {
  staffId: string
  entry: DayStaffEntry
  onClose: () => void
  onSaved?: () => void
}

export function StaffDetailModal({ staffId, entry, onClose, onSaved }: Props) {
  const [profile, setProfile]               = useState<StaffProfile | null>(null)
  const [loading, setLoading]               = useState(true)
  const [imgError, setImgError]             = useState(false)
  const [showOverrideDialog, setShowOverrideDialog] = useState(false)

  useEffect(() => {
    createClient()
      .from('internal_profiles')
      .select('full_name, nickname, email, phone, role, avatar_url, branches(name)')
      .eq('id', staffId)
      .single()
      .then(({ data }) => {
        setProfile(data as StaffProfile | null)
        setLoading(false)
      })
  }, [staffId])

  const displayName = profile?.nickname || profile?.full_name || entry.full_name
  const showImg     = !!(profile?.avatar_url) && !imgError

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-card rounded-2xl border border-border w-full max-w-sm shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header gradient strip */}
          <div
            className="px-5 pt-5 pb-4 flex items-start justify-between gap-3"
            style={{ background: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 50%, #FF0090 100%)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full border-2 border-white/30 overflow-hidden shrink-0">
                {showImg ? (
                  <img
                    src={profile!.avatar_url!}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center text-lg font-bold text-white">
                    {getInitials(displayName)}
                  </div>
                )}
              </div>

              {/* Names */}
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">
                  {profile?.nickname || entry.nickname || profile?.full_name || entry.full_name}
                </p>
                {(profile?.nickname || entry.nickname) && (
                  <p className="text-white/60 text-[11px] truncate">
                    {profile?.full_name || entry.full_name}
                  </p>
                )}
                {profile && (
                  <span className="mt-1 inline-block text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white/90 font-bold uppercase">
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Memuat...
              </div>
            ) : (
              <>
                {/* Contact */}
                {profile?.email && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{profile.email}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground">{profile.phone}</span>
                  </div>
                )}
                {profile?.branches?.name && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Building2 size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground">{profile.branches.name}</span>
                  </div>
                )}

                {/* Today's schedule */}
                <div className="pt-2 border-t border-border space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Jadwal Hari Ini</p>
                  {entry.hasSchedule && !entry.isOnLeave ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <BadgeCheck size={13} className={entry.isOverride ? 'text-secondary shrink-0' : 'text-[#34C759] shrink-0'} />
                      <span className={`text-sm ${entry.isOverride ? 'text-secondary' : 'text-foreground'}`}>
                        Shift {entry.shift} · {entry.jam_mulai}–{entry.jam_selesai}
                      </span>
                      {entry.isOverride && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-bold uppercase">
                          TEMP
                        </span>
                      )}
                    </div>
                  ) : entry.isOnLeave ? (
                    <p className="text-sm text-amber-500">Cuti{entry.leaveReason ? ` — ${entry.leaveReason}` : ''}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tidak ada jadwal</p>
                  )}
                </div>

                {/* Override management button */}
                <div className="pt-1">
                  <button
                    onClick={() => setShowOverrideDialog(true)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-secondary/40 text-secondary hover:bg-secondary/10 transition-colors font-medium w-full justify-center cursor-pointer"
                  >
                    <CalendarClock size={13} />
                    Kelola Jadwal Sementara
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showOverrideDialog && (
        <ScheduleOverrideDialog
          staffId={staffId}
          staffName={displayName}
          branchId={entry.branch_id}
          onClose={() => setShowOverrideDialog(false)}
          onSaved={() => {
            setShowOverrideDialog(false)
            onSaved?.()
          }}
        />
      )}
    </>
  )
}
