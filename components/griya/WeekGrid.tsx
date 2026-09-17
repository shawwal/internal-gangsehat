'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, UserX, Move, GraduationCap, CreditCard, ExternalLink, UserPlus2, Pencil, RotateCcw, Plus } from 'lucide-react'
import type { GriyaWeek, Discipline, Hari } from '@/app/actions/griyaJadwal'
import { GRIYA_HOURS, DISCIPLINE_LABEL, DISCIPLINE_COLOR, HARI_LABEL, JS_DAY_TO_HARI, hariOf } from './constants'
import { resolveDay, type ResolvedCell } from './resolve'
import { addDays, toIso, isSameDay } from '@/components/jadwal/utils'
import type { CellAction } from './SlotCell'

export interface WeekEntry {
  key: string
  dateIso: string
  hari: Hari
  cell: ResolvedCell
  studentName: string
  patientId: string | null
  therapistNick: string
  discipline: Discipline
}

const STATE_CLS: Record<string, string> = {
  scheduled: 'bg-primary/15 border-primary/50 text-foreground',
  hadir: 'bg-[#34C759] border-[#34C759] text-white',
  izin: 'bg-[#FFB35C]/25 border-[#FFB35C]/60 text-foreground',
  alpa: 'bg-[#FF3B30]/15 border-[#FF3B30]/60 text-foreground',
  adhoc: 'bg-purple-500/15 border-purple-500/60 text-foreground',
}

interface Props {
  week: GriyaWeek
  weekMonday: Date
  today: Date
  disciplineFilter: Discipline | 'ALL'
  canEdit: boolean
  onCellAction: (action: CellAction, entry: WeekEntry) => void
  onAddClick: (dateIso: string, hari: Hari, hour: string) => void
}

export function WeekGrid({ week, weekMonday, today, disciplineFilter, canEdit, onCellAction, onAddClick }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; entry: WeekEntry } | null>(null)

  const nickById = useMemo(() => {
    const m = new Map<string, { nick: string; discipline: Discipline }>()
    for (const t of week.therapists) m.set(t.therapist_id, { nick: t.nickname || t.full_name, discipline: t.discipline })
    return m
  }, [week.therapists])

  const days = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(weekMonday, n)), [weekMonday])

  // grid[hour][dayIndex] → entries
  const grid = useMemo(() => {
    const g = new Map<string, WeekEntry[][]>()
    for (const hour of GRIYA_HOURS) g.set(hour, days.map(() => []))

    days.forEach((d, di) => {
      const iso = toIso(d)
      const { cells, unassigned } = resolveDay(week, iso)
      for (const cell of [...cells.values(), ...unassigned]) {
        if (cell.state === 'moved-out') continue
        const meta = nickById.get(cell.therapistId)
        const discipline = meta?.discipline ?? (cell.slot?.discipline as Discipline) ?? 'FISIOTERAPI'
        if (disciplineFilter !== 'ALL' && discipline !== disciplineFilter) continue
        const row = g.get(cell.hour)
        if (!row) continue
        row[di].push({
          key: cell.key + '|' + iso,
          dateIso: iso,
          hari: hariOf(d),
          cell,
          studentName: cell.studentName,
          patientId: cell.slot?.patient_id ?? cell.visit?.patient_id ?? null,
          therapistNick: meta?.nick ?? '—',
          discipline,
        })
      }
    })

    for (const rows of g.values()) {
      for (const list of rows) {
        list.sort((a, b) =>
          a.discipline.localeCompare(b.discipline) ||
          a.therapistNick.localeCompare(b.therapistNick) ||
          a.studentName.localeCompare(b.studentName),
        )
      }
    }
    return g
  }, [week, days, nickById, disciplineFilter])

  const perDayCount = useMemo(
    () => days.map((_, di) => GRIYA_HOURS.reduce((sum, h) => sum + (grid.get(h)?.[di].length ?? 0), 0)),
    [days, grid],
  )

  const dayColWidth = 190

  function openMenu(e: React.MouseEvent, entry: WeekEntry) {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, entry })
  }

  function act(action: CellAction) {
    if (!menu) return
    onCellAction(action, menu.entry)
    setMenu(null)
  }

  const m = menu?.entry
  const freed = m ? (m.cell.state === 'izin' || m.cell.state === 'alpa') : false

  return (
    <div className="glass-card overflow-auto" style={{ maxHeight: 'calc(100vh - 15rem)' }}>
      <div style={{ minWidth: 72 + days.length * dayColWidth }}>
        {/* day headers */}
        <div className="flex sticky top-0 z-20 bg-background border-b border-border">
          <div className="w-[72px] shrink-0" />
          {days.map((d, i) => {
            const isTod = isSameDay(d, today)
            return (
              <div
                key={i}
                style={{ width: dayColWidth }}
                className={`px-2 py-2 text-center border-l border-border ${isTod ? 'bg-primary/10' : ''}`}
              >
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${isTod ? 'text-primary' : 'text-foreground'}`}>
                  {HARI_LABEL[JS_DAY_TO_HARI[d.getDay()]]}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {d.getDate()}/{d.getMonth() + 1} · {perDayCount[i]} sesi
                </div>
              </div>
            )
          })}
        </div>

        {/* hour rows */}
        {GRIYA_HOURS.map((hour) => {
          const row = grid.get(hour) ?? []
          return (
            <div key={hour} className="flex border-b border-border/40">
              <div className="w-[72px] shrink-0 flex items-start justify-end pr-2 pt-2 text-[12px] font-mono text-muted-foreground">
                {hour}
              </div>
              {days.map((d, di) => {
                const entries = row[di] ?? []
                const isTod = isSameDay(d, today)
                const iso = toIso(d)
                return (
                  <div
                    key={di}
                    style={{ width: dayColWidth }}
                    className={`group/cell p-1.5 border-l border-border/40 space-y-1 ${isTod ? 'bg-primary/[0.04]' : ''}`}
                  >
                    {entries.map((e) => {
                      const cls = STATE_CLS[e.cell.state] ?? STATE_CLS.scheduled
                      const inner = (
                        <>
                          <span className="block truncate font-medium">{e.studentName}</span>
                          <span className="flex items-center gap-1 truncate text-[9px] opacity-80">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${DISCIPLINE_COLOR[e.discipline]?.dot ?? 'bg-muted-foreground'}`} />
                            <span className="truncate">{DISCIPLINE_LABEL[e.discipline]}</span>
                          </span>
                        </>
                      )
                      return e.patientId ? (
                        <a
                          key={e.key}
                          href={`/griya-anak/siswa/${e.patientId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onContextMenu={(ev) => openMenu(ev, e)}
                          className={`block rounded-lg border px-1.5 py-1 text-[11px] leading-tight ${cls} hover:opacity-90`}
                        >
                          {inner}
                        </a>
                      ) : (
                        <div
                          key={e.key}
                          onContextMenu={(ev) => openMenu(ev, e)}
                          className={`rounded-lg border px-1.5 py-1 text-[11px] leading-tight ${cls}`}
                        >
                          {inner}
                        </div>
                      )
                    })}
                    {canEdit && (
                      <button
                        onClick={() => onAddClick(iso, JS_DAY_TO_HARI[d.getDay()], hour)}
                        className="w-full flex items-center justify-center py-1 rounded-lg border border-dashed border-[#34C759]/50 text-[#34C759] opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer"
                        title="Tambah jadwal"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {menu && m && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
          <div
            className="fixed z-[61] glass-card p-1.5 w-52 text-sm shadow-2xl"
            style={{ top: Math.min(menu.y, window.innerHeight - 320), left: Math.min(menu.x, window.innerWidth - 220) }}
          >
            {m.cell.slot && m.cell.state === 'scheduled' && !m.cell.therapistId && canEdit && (
              <MenuBtn icon={<UserPlus2 size={14} />} label="Isi Terapis" onClick={() => act('coverUnassigned')} />
            )}
            {m.cell.slot && m.cell.state === 'scheduled' && m.cell.therapistId && canEdit && (
              <>
                <MenuBtn icon={<Check size={14} />} label="Tandai Hadir" onClick={() => act('markPresent')} />
                <MenuBtn icon={<UserX size={14} />} label="Tandai Tidak Hadir" onClick={() => act('attendance')} />
                <MenuBtn icon={<Move size={14} />} label="Pindahkan" onClick={() => act('move')} />
                <MenuBtn icon={<GraduationCap size={14} />} label="Akhiri Jadwal" onClick={() => act('end')} />
              </>
            )}
            {m.cell.slot && m.cell.state === 'hadir' && canEdit && (
              <>
                <MenuBtn icon={<UserX size={14} />} label="Tandai Tidak Hadir" onClick={() => act('attendance')} />
                <MenuBtn icon={<RotateCcw size={14} />} label="Batalkan Tanda Hadir" onClick={() => act('unmarkAttendance')} />
              </>
            )}
            {m.cell.slot && (m.cell.state === 'izin' || m.cell.state === 'alpa') && canEdit && (
              <>
                <MenuBtn icon={<Check size={14} />} label="Ubah jadi Hadir" onClick={() => act('markPresent')} />
                <MenuBtn icon={<RotateCcw size={14} />} label="Batalkan Tanda" onClick={() => act('unmarkAttendance')} />
              </>
            )}
            {!m.cell.slot && m.cell.state === 'adhoc' && canEdit && (
              m.cell.visit?.kehadiran === 'HADIR' ? (
                <MenuBtn icon={<RotateCcw size={14} />} label="Batalkan Tanda Hadir" onClick={() => act('unmarkAttendance')} />
              ) : (
                <MenuBtn icon={<Check size={14} />} label="Tandai Hadir" onClick={() => act('markPresent')} />
              )
            )}
            {freed && canEdit && (
              <MenuBtn icon={<UserPlus2 size={14} />} label="Cari Pengganti" onClick={() => act('substitute')} />
            )}
            {canEdit && m.cell.visit?.id && (
              <MenuBtn icon={<Pencil size={14} />} label="Ubah Kunjungan" onClick={() => act('editVisit')} />
            )}
            {canEdit && <MenuBtn icon={<CreditCard size={14} />} label="Bayar" onClick={() => act('pay')} />}
            <MenuBtn icon={<ExternalLink size={14} />} label="Lihat Siswa" onClick={() => act('open')} />
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

function MenuBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-left cursor-pointer">
      {icon}{label}
    </button>
  )
}
