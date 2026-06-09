'use client'

import { formatPct, getInitials } from './utils'
import type { FisioStats, StaffTargetRow } from './types'

interface LeaderboardTableProps {
  data: FisioStats[]
  targets: StaffTargetRow[]
}

function AvatarSmall({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div
      className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-semibold text-white text-xs shrink-0"
      style={{
        background: avatarUrl
          ? undefined
          : 'linear-gradient(135deg, var(--primary), var(--secondary))',
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : getInitials(name)
      }
    </div>
  )
}

function CapaianBadge({ pct }: { pct: string }) {
  if (pct === '—') return <span className="text-xs text-muted-foreground">—</span>
  const num = parseFloat(pct)
  const color = num >= 100
    ? 'bg-chart-4/15 text-chart-4'
    : num >= 80
    ? 'bg-secondary/15 text-secondary'
    : 'bg-destructive/10 text-destructive'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${color}`}>
      {pct}
    </span>
  )
}

export function LeaderboardTable({ data, targets }: LeaderboardTableProps) {
  const targetMap = new Map(targets.map(t => [t.staff_id, t.target_kunjungan]))

  if (!data.length) {
    return (
      <div className="glass-card p-6 text-center text-sm text-muted-foreground">
        Belum ada data
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-5 pb-3 border-b border-border/40">
        <h2 className="text-sm font-semibold text-foreground">Peringkat Lengkap</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              {['#', 'Fisioterapis', 'Total', 'TA', 'Paket', 'Sesi', '% Capaian'].map(h => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((f, i) => {
              const rank = i + 1
              const isFirst = rank === 1
              const tgt = targetMap.get(f.staff_id)
              const capaian = tgt ? formatPct(f.total, tgt) : '—'

              return (
                <tr
                  key={f.staff_id}
                  className={`border-b border-border/25 transition-colors duration-150 ${
                    isFirst
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-muted/20'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        rank === 1 ? 'bg-yellow-400/20 text-yellow-600' :
                        rank === 2 ? 'bg-gray-200/50 text-gray-500' :
                        rank === 3 ? 'bg-amber-400/20 text-amber-600' :
                        'text-muted-foreground'
                      }`}
                    >
                      {rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AvatarSmall name={f.name} avatarUrl={f.avatar_url} />
                      <span className={`text-xs font-medium ${isFirst ? 'text-primary' : 'text-foreground'}`}>
                        {f.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${isFirst ? 'text-primary' : 'text-foreground'}`}>
                      {f.total.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{f.ta}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{f.paket}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{f.sesi}</td>
                  <td className="px-4 py-3">
                    <CapaianBadge pct={capaian} />
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
