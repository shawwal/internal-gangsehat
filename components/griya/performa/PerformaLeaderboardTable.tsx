'use client'

import { getInitials } from './utils'
import type { TherapistPerforma } from './types'

interface Props {
  rows: TherapistPerforma[]
  onSelectTherapist: (therapist: TherapistPerforma) => void
}

function AvatarSmall({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div
      className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-semibold text-white text-xs shrink-0"
      style={{
        background: avatarUrl ? undefined : 'linear-gradient(135deg, var(--primary), var(--secondary))',
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}

export function PerformaLeaderboardTable({ rows, onSelectTherapist }: Props) {
  if (!rows.length) {
    return (
      <div className="glass-card p-6 text-center text-sm text-muted-foreground">
        Belum ada terapis terdaftar di Griya Anak.
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-5 pb-3 border-b border-border/40">
        <h2 className="text-sm font-semibold text-foreground">Peringkat Lengkap</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Total sesi ditandai hadir pada periode terpilih</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              {['#', 'Terapis', 'Total Sesi (Hadir)'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rank = i + 1
              const isFirst = rank === 1
              const displayName = r.nickname || r.name

              return (
                <tr
                  key={r.therapist_id}
                  className={`border-b border-border/25 transition-colors duration-150 ${
                    isFirst ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/20'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        rank === 1
                          ? 'bg-yellow-400/20 text-yellow-600'
                          : rank === 2
                          ? 'bg-gray-200/50 text-gray-500'
                          : rank === 3
                          ? 'bg-amber-400/20 text-amber-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AvatarSmall name={displayName} avatarUrl={r.avatar_url} />
                      <span className={`text-xs font-medium ${isFirst ? 'text-primary' : 'text-foreground'}`}>
                        {displayName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.total > 0 ? (
                      <button
                        onClick={() => onSelectTherapist(r)}
                        className={`text-sm font-bold underline-offset-2 hover:underline cursor-pointer ${isFirst ? 'text-primary' : 'text-foreground'}`}
                      >
                        {r.total.toLocaleString('id-ID')}
                      </button>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
