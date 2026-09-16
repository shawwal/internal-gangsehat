'use client'

import { Crown, Medal } from 'lucide-react'
import { getInitials } from './utils'
import type { TherapistPerforma } from './types'

interface Props {
  top3: TherapistPerforma[]
}

function AvatarCircle({
  name,
  avatarUrl,
  size = 56,
  ring = false,
}: {
  name: string
  avatarUrl: string | null
  size?: number
  ring?: boolean
}) {
  return (
    <div
      className={`rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0 ${ring ? 'ring-4 ring-primary' : ''}`}
      style={{
        width: size,
        height: size,
        background: avatarUrl ? undefined : 'linear-gradient(135deg, var(--primary), var(--secondary))',
        fontSize: Math.round(size * 0.3),
      }}
    >
      {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : getInitials(name)}
    </div>
  )
}

function PodiumCard({ therapist, rank, delay }: { therapist: TherapistPerforma; rank: number; delay: number }) {
  const isFirst = rank === 1
  const heights = { 1: 'mt-0', 2: 'mt-8', 3: 'mt-12' } as Record<number, string>
  const rankColors = {
    1: { bg: 'var(--primary)', text: 'var(--primary)', icon: 'text-yellow-400' },
    2: { bg: '#9CA3AF', text: '#9CA3AF', icon: 'text-gray-400' },
    3: { bg: '#F59E0B', text: '#F59E0B', icon: 'text-amber-500' },
  } as Record<number, { bg: string; text: string; icon: string }>
  const rc = rankColors[rank]
  const displayName = therapist.nickname || therapist.name

  return (
    <div
      className={`flex flex-col items-center animate-podium-rise ${heights[rank] ?? 'mt-8'}`}
      style={{ '--stagger-delay': `${delay}ms` } as React.CSSProperties}
    >
      {isFirst ? (
        <Crown size={22} className="text-yellow-400 mb-1.5 drop-shadow-sm" />
      ) : (
        <Medal size={18} className={`${rc.icon} mb-1.5`} />
      )}

      <AvatarCircle name={displayName} avatarUrl={therapist.avatar_url} size={isFirst ? 64 : 52} ring={isFirst} />

      <div
        className={`glass-card mt-3 p-4 text-center w-full ${isFirst ? 'border-primary/40 shadow-lg shadow-primary/10' : ''}`}
        style={isFirst ? { borderColor: 'var(--primary)', borderWidth: 1.5 } : {}}
      >
        <div
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white font-bold text-[10px] mb-2"
          style={{ backgroundColor: rc.bg }}
        >
          {rank}
        </div>

        <p className="text-sm font-semibold text-foreground leading-tight mb-0.5 line-clamp-1">
          {displayName.split(' ')[0]}
        </p>
        <p className="text-xl font-bold" style={{ color: rc.text }}>
          {therapist.total.toLocaleString('id-ID')}
          <span className="text-xs font-normal text-muted-foreground ml-1">sesi</span>
        </p>
      </div>
    </div>
  )
}

export function PerformaPodium({ top3 }: Props) {
  const withSessions = top3.filter((t) => t.total > 0)
  if (!withSessions.length) {
    return (
      <div className="glass-card p-8 text-center text-sm text-muted-foreground">
        Belum ada sesi ditandai hadir pada periode ini.
      </div>
    )
  }

  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean)
  const delays = [150, 0, 280]

  return (
    <div className="glass-card p-6">
      <h2 className="text-sm font-semibold text-foreground mb-6">Podium Teratas</h2>
      <div className="flex items-end justify-center gap-4">
        {ordered.map((t, i) => {
          const rank = t.therapist_id === top3[0].therapist_id ? 1 : t.therapist_id === top3[1]?.therapist_id ? 2 : 3
          return (
            <div key={t.therapist_id} className="flex-1 max-w-[160px]">
              <PodiumCard therapist={t} rank={rank} delay={delays[i]} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
