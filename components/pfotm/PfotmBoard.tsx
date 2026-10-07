'use client'

import { useState } from 'react'
import { Crown, Medal, Trophy } from 'lucide-react'
import type { BoardRow, PointRule } from '@/lib/pfotm/engine'
import { Modal } from '@/components/payroll/Modal'

interface Props {
  board: BoardRow[]
  rules: PointRule[]
  wins: Record<string, number>
  live: boolean
}

const PODIUM = [
  { rank: 1, ring: 'ring-[#F5C542]', bg: 'from-[#F5C542]/25 to-transparent', icon: 'text-[#E3A90F]', height: 'sm:min-h-[260px]' },
  { rank: 2, ring: 'ring-[#B8BEC8]', bg: 'from-[#B8BEC8]/25 to-transparent', icon: 'text-[#8A93A1]', height: 'sm:min-h-[230px]' },
  { rank: 3, ring: 'ring-[#D08B55]', bg: 'from-[#D08B55]/25 to-transparent', icon: 'text-[#B5713E]', height: 'sm:min-h-[210px]' },
]

const pct = (n: number) => `${Math.round(n * 100)}%`

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function Avatar({ row, size }: { row: BoardRow; size: number }) {
  return (
    <div className="rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32), background: row.avatarUrl ? undefined : 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
      {row.avatarUrl ? <img src={row.avatarUrl} alt={row.name} className="w-full h-full object-cover" /> : initials(row.name)}
    </div>
  )
}

function WinBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F5C542]/20 text-[#B98A07]" title={`Juara ${count} bulan`}>
      <Trophy size={10} /> {count}×
    </span>
  )
}

export function PfotmBoard({ board, rules, wins, live }: Props) {
  const [detail, setDetail] = useState<BoardRow | null>(null)
  const top = board.slice(0, 3)
  const rest = board.slice(3)
  const max = Math.max(1, ...board.map((r) => r.total))
  const winsOf = (r: BoardRow) => wins[r.key] ?? wins[r.name] ?? 0
  // Visual order on wide screens: 2 – 1 – 3
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean) as BoardRow[]

  if (!board.length) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Belum ada peserta.</div>
  }

  return (
    <div className="space-y-5">
      {live && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-chart-4 animate-pulse" /> Peringkat sementara — diperbarui otomatis sampai periode dikunci.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        {podiumOrder.map((row, i) => {
          const style = PODIUM[row.rank - 1]
          return (
            <button key={row.key} onClick={() => setDetail(row)}
              className={`animate-podium-rise relative rounded-3xl border border-border bg-gradient-to-b ${style.bg} bg-card p-5 flex flex-col items-center text-center gap-2 hover:shadow-lg transition ${style.height} ${row.rank === 1 ? 'order-first sm:order-none' : ''}`}
              style={{ animationDelay: `${i * 90}ms` }}>
              <div className="absolute top-3 left-3 flex items-center gap-1">
                {row.rank === 1 ? <Crown size={18} className={style.icon} /> : <Medal size={18} className={style.icon} />}
                <span className={`text-sm font-black ${style.icon}`}>#{row.rank}</span>
              </div>
              <div className="absolute top-3 right-3"><WinBadge count={winsOf(row)} /></div>
              <div className={`mt-4 rounded-full ring-4 ${style.ring}`}><Avatar row={row} size={row.rank === 1 ? 84 : 68} /></div>
              <p className="font-bold text-foreground leading-tight">{row.name}</p>
              <p className={`font-black ${row.rank === 1 ? 'text-4xl text-primary' : 'text-3xl text-foreground'}`}>{row.total.toLocaleString('id-ID')}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground -mt-1">poin</p>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span>Hadir {pct(row.kpis.kehadiran)}</span>
                <span>Disiplin {pct(row.kpis.disiplin)}</span>
                <span>{row.kpis.jumlah_paket} paket</span>
              </div>
              {row.tiedOnPoints && <span className="text-[10px] text-muted-foreground">seri poin — diurutkan dari jumlah kunjungan</span>}
            </button>
          )
        })}
      </div>

      {rest.length > 0 && (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {rest.map((row, i) => (
            <button key={row.key} onClick={() => setDetail(row)} className="animate-fade-in-up w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
              style={{ animationDelay: `${(i + 3) * 40}ms` }}>
              <span className="w-7 text-center text-sm font-bold text-muted-foreground">{row.rank}</span>
              <Avatar row={row} size={34} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground truncate">{row.name}</span>
                  <WinBadge count={winsOf(row)} />
                  {row.tiedOnPoints && <span className="text-[10px] text-muted-foreground">seri</span>}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.max(2, (row.total / max) * 100)}%` }} />
                </div>
              </div>
              <div className="hidden md:flex gap-4 text-[11px] text-muted-foreground">
                <span>Hadir {pct(row.kpis.kehadiran)}</span>
                <span>Disiplin {pct(row.kpis.disiplin)}</span>
                <span>{row.kpis.kunjungan_per_hadir.toFixed(1)} kunj/hari</span>
              </div>
              <span className="text-lg font-black text-foreground w-14 text-right">{row.total.toLocaleString('id-ID')}</span>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <Modal title={`#${detail.rank} ${detail.name}`} subtitle={`${detail.total.toLocaleString('id-ID')} poin`} onClose={() => setDetail(null)}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="py-1.5 text-left font-medium">Metrik</th>
                <th className="py-1.5 text-right font-medium">Jumlah</th>
                <th className="py-1.5 text-right font-medium">Bobot</th>
                <th className="py-1.5 text-right font-medium">Poin</th>
              </tr>
            </thead>
            <tbody>
              {rules.filter((r) => r.is_active !== false).map((r) => {
                const pts = detail.breakdown[r.metric_key] ?? 0
                return (
                  <tr key={r.metric_key} className="border-b border-border last:border-0">
                    <td className="py-1.5 text-foreground">{r.metric_label}</td>
                    <td className="py-1.5 text-right">{detail.metrics[r.metric_key] ?? 0}</td>
                    <td className="py-1.5 text-right text-muted-foreground">×{Number(r.weight)}</td>
                    <td className={`py-1.5 text-right font-semibold ${pts < 0 ? 'text-destructive' : 'text-foreground'}`}>{pts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            {[
              ['% Kehadiran', pct(detail.kpis.kehadiran)],
              ['% Disiplin', pct(detail.kpis.disiplin)],
              ['Kunjungan / hadir', detail.kpis.kunjungan_per_hadir.toFixed(2)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-muted/50 p-2">
                <p className="text-base font-bold text-foreground">{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
