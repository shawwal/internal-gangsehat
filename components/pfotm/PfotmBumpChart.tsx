'use client'

import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Loader2 } from 'lucide-react'
import { getPfotmDailyMetrics, type PfotmDailyMetrics, type PfotmEntry } from '@/app/actions/pfotm'
import { rankBoard, type PointRule } from '@/lib/pfotm/engine'

interface Props {
  periodId: string
  entries: PfotmEntry[]
  rules: PointRule[]
  workingDays: number
}

type Row = Record<string, number | string>

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

/**
 * Day-by-day rank (bump chart) under the leaderboard. Each day is ranked with
 * the same engine, rules and working days as the board, from cumulative
 * metrics; the last day equals the current ranking. One series per therapist
 * is too many hues, so lines stay neutral and the focused therapist (hover /
 * click; default #1) is drawn in the primary color.
 */
export function PfotmBumpChart({ periodId, entries, rules, workingDays }: Props) {
  const [daily, setDaily] = useState<{ periodId: string; data: PfotmDailyMetrics } | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPfotmDailyMetrics(periodId).then((res) => {
      if (!cancelled && res.ok) setDaily({ periodId, data: res.data })
    })
    return () => { cancelled = true }
  }, [periodId])

  const names = useMemo(() => new Map(entries.map((e) => [e.id, e.display_name])), [entries])

  const { rows, series, count } = useMemo(() => {
    if (!daily || daily.periodId !== periodId) return { rows: [] as Row[], series: [] as string[], count: 0 }
    const { dates, entries: perEntry } = daily.data
    const ids = perEntry.map((e) => e.entryId).filter((id) => names.has(id))
    const rows: Row[] = dates.map((date, i) => {
      const ranked = rankBoard(
        perEntry.filter((e) => names.has(e.entryId)).map((e) => ({ key: e.entryId, name: names.get(e.entryId)!, metrics: e.metricsByDay[i] ?? {} })),
        rules,
        workingDays,
      )
      const row: Row = { date, day: fmtDay(date) }
      for (const r of ranked) row[r.key] = r.rank
      return row
    })
    return { rows, series: ids, count: ids.length }
  }, [daily, periodId, names, rules, workingDays])

  if (!daily || daily.periodId !== periodId) {
    return (
      <div className="glass-card p-6 flex justify-center text-muted-foreground"><Loader2 size={18} className="animate-spin" /></div>
    )
  }
  if (rows.length < 2 || count < 2) return null

  const last = rows[rows.length - 1]
  const leader = series.find((id) => last[id] === 1) ?? series[0]
  const focus = hovered ?? selected ?? leader
  const lastIndex = rows.length - 1
  // Order the chips by today's rank so they read like the board.
  const ordered = [...series].sort((a, b) => Number(last[a]) - Number(last[b]))

  return (
    <div className="glass-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Perubahan peringkat harian</p>
        <p className="text-xs text-muted-foreground">
          Posisi tiap fisioterapis dari hari ke hari (kumulatif sejak awal periode). Arahkan / klik nama untuk menyorot.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(560, rows.length * 30 + 140), height: Math.max(220, count * 30 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 12, right: 96, left: 0, bottom: 4 }} onMouseLeave={() => setHovered(null)}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" tickLine={false} />
              <YAxis
                reversed
                domain={[1, count]}
                ticks={Array.from({ length: count }, (_, i) => i + 1)}
                tickFormatter={(v) => `#${v}`}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                width={36}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const row = payload[0].payload as Row
                  const list = [...series].sort((a, b) => Number(row[a]) - Number(row[b]))
                  return (
                    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-foreground mb-1">{label}</p>
                      {list.map((id) => (
                        <p key={id} className={id === focus ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                          #{row[id]} {names.get(id)}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              {/* Neutral lines first, focused one last so it draws on top. */}
              {[...series.filter((id) => id !== focus), focus].map((id) => {
                const isFocus = id === focus
                return (
                  <Line
                    key={id}
                    dataKey={id}
                    name={names.get(id)}
                    type="monotone"
                    stroke={isFocus ? 'var(--primary)' : 'var(--muted-foreground)'}
                    strokeOpacity={isFocus ? 1 : 0.35}
                    strokeWidth={isFocus ? 3 : 2}
                    dot={{ r: isFocus ? 4 : 3, strokeWidth: 2, stroke: 'var(--card)', fill: isFocus ? 'var(--primary)' : 'var(--muted-foreground)', fillOpacity: isFocus ? 1 : 0.5 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                    onMouseEnter={() => setHovered(id)}
                    onClick={() => setSelected((s) => (s === id ? null : id))}
                    label={({ index, x, y }: { index?: number; x?: number | string; y?: number | string }) =>
                      index === lastIndex ? (
                        <text
                          x={Number(x) + 10} y={Number(y)} dy={4} fontSize={11}
                          fontWeight={isFocus ? 700 : 500}
                          fill={isFocus ? 'var(--foreground)' : 'var(--muted-foreground)'}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelected((s) => (s === id ? null : id))}
                        >
                          {names.get(id)}
                        </text>
                      ) : <g />
                    }
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend / picker — identity never relies on color alone. */}
      <div className="flex flex-wrap gap-1.5">
        {ordered.map((id) => (
          <button
            key={id}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setSelected((s) => (s === id ? null : id))}
            aria-pressed={selected === id}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
              id === focus ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            #{String(last[id])} {names.get(id)}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Kegiatan eksternal &amp; koreksi manual tidak bertanggal, jadi dihitung penuh sejak hari pertama.
      </p>
    </div>
  )
}
