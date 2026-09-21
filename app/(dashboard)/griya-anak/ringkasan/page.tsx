'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, CheckCircle2, ClipboardCheck, Clock, ExternalLink, Loader2, RefreshCw, UserX, Users } from 'lucide-react'
import { useGriyaJadwal } from '@/hooks/useGriyaJadwal'
import { useToast } from '@/context/ToastContext'
import { DateNav } from '@/components/jadwal/DateNav'
import { DISCIPLINE_COLOR, DISCIPLINE_LABEL, HARI_LABEL, hariOf, toIso } from '@/components/griya/constants'
import { resolveDay, therapistColumns, type ResolvedCell } from '@/components/griya/resolve'
import {
  fetchGriyaAdminRecords, sendGriyaRecordReminders,
  type GriyaAdminRecords, type PendingRecord,
} from '@/app/actions/griyaAdminDashboard'

const EMPTY_RECORDS: GriyaAdminRecords = { stateByVisit: {}, pending: [] }

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

export default function GriyaAdminDashboardPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, branchId, reload } = useGriyaJadwal()
  const { showToast } = useToast()
  const [records, setRecords] = useState<GriyaAdminRecords>(EMPTY_RECORDS)
  const [reminding, setReminding] = useState<string | null>(null)

  const dateIso = toIso(selectedDate)
  const hari = hariOf(selectedDate)

  const loadRecords = useCallback(async () => {
    const r = await fetchGriyaAdminRecords(dateIso)
    setRecords(r)
  }, [dateIso])
  useEffect(() => { loadRecords() }, [loadRecords])

  const { cells, unassigned } = useMemo(() => resolveDay(week, dateIso), [week, dateIso])
  const cols = useMemo(() => therapistColumns(week.therapists), [week.therapists])

  const rows = useMemo(() => {
    const all = [...cells.values()].flat().filter((c) => c.state !== 'moved-out')
    return cols.map((t) => {
      const mine = all.filter((c) => c.therapistId === t.therapist_id).sort((a, b) => a.hour.localeCompare(b.hour))
      const hadir = mine.filter((c) => c.state === 'hadir' || c.visit?.kehadiran === 'HADIR')
      const needRecord = hadir.filter((c) => c.visit?.id && records.stateByVisit[c.visit.id] !== undefined)
      const done = needRecord.filter((c) => records.stateByVisit[c.visit!.id] === 'done').length
      const backlog = records.pending.filter((p) => p.staffId === t.therapist_id)
      return {
        t, mine, hadir: hadir.length,
        absen: mine.filter((c) => c.state === 'izin' || c.state === 'alpa').length,
        waiting: mine.filter((c) => c.state === 'scheduled').length,
        needRecord: needRecord.length, done, backlog,
      }
    })
  }, [cells, cols, records])

  const totals = useMemo(() => {
    const sum = (k: 'hadir' | 'absen' | 'waiting' | 'needRecord' | 'done') => rows.reduce((n, r) => n + r[k], 0)
    return {
      students: rows.reduce((n, r) => n + r.mine.length, 0) + unassigned.length,
      hadir: sum('hadir'), waiting: sum('waiting'), absen: sum('absen'),
      pct: sum('needRecord') === 0 ? 100 : Math.round((sum('done') / sum('needRecord')) * 100),
      pending: records.pending.length,
    }
  }, [rows, unassigned, records])

  async function remind(staffId?: string) {
    setReminding(staffId ?? 'all')
    const { sent, skipped, error } = await sendGriyaRecordReminders(dateIso, staffId)
    setReminding(null)
    if (error) { showToast(error, 'error'); return }
    if (sent === 0 && skipped === 0) { showToast('Tidak ada rekam medis yang belum lengkap', 'info'); return }
    showToast(`Pengingat: ${sent} terkirim${skipped ? `, ${skipped} sudah dikirim hari ini` : ''}`, 'success')
  }

  function openRecord(p: PendingRecord) {
    const url = p.kind === 'terapi-awal'
      ? `/griya-anak/siswa/${p.patientId}/terapi-awal/${p.visitId}`
      : `/griya-anak/siswa/${p.patientId}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (branchId === null && enabled === false) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>
  }

  const nameOf = (id: string) => {
    const t = week.therapists.find((x) => x.therapist_id === id)
    return t ? (t.nickname || t.full_name) : 'Terapis'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard Griya Anak</h1>
          <p className="text-sm text-muted-foreground">
            {HARI_LABEL[hari]}, {selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { reload(); loadRecords() }} className="p-2 rounded-xl border border-border hover:bg-muted cursor-pointer text-muted-foreground" aria-label="Muat ulang">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => remind()}
            disabled={reminding !== null || records.pending.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            {reminding === 'all' ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} Ingatkan Semua
          </button>
        </div>
      </div>

      <DateNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Anak Terjadwal', value: totals.students, icon: Users, color: 'bg-primary/10 text-primary' },
          { label: 'Sudah Hadir', value: totals.hadir, icon: CheckCircle2, color: 'bg-[#34C759]/10 text-[#34C759]' },
          { label: 'Menunggu', value: totals.waiting, icon: Clock, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Tidak Hadir', value: totals.absen, icon: UserX, color: 'bg-destructive/10 text-destructive' },
          { label: 'Rekam Medis Lengkap', value: `${totals.pct}%`, icon: ClipboardCheck, color: 'bg-[#FFB35C]/10 text-[#FFB35C]' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}><s.icon size={17} /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-lg font-semibold text-foreground leading-tight">{loading ? '–' : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className="glass-card p-3 border border-amber-400/30 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400">
          <b>{unassigned.length} anak belum punya terapis bertugas:</b> {unassigned.map((u) => `${u.studentName} (${u.hour})`).join(', ')}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h2 className="text-sm font-semibold text-foreground">Aktivitas Terapis</h2></div>
        {loading ? <div className="h-32 animate-pulse" /> : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Belum ada terapis di jadwal Griya Anak.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Terapis</th>
                  <th className="text-center px-3 py-2 font-medium">Anak</th>
                  <th className="text-center px-3 py-2 font-medium">Hadir</th>
                  <th className="text-center px-3 py-2 font-medium">Menunggu</th>
                  <th className="text-center px-3 py-2 font-medium">Rekam Medis</th>
                  <th className="text-center px-3 py-2 font-medium">Tertunggak</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.t.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.t.nickname || r.t.full_name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DISCIPLINE_COLOR[r.t.discipline].band}`}>
                        {DISCIPLINE_LABEL[r.t.discipline]}
                      </span>
                      {r.mine.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 max-w-xs">
                          {r.mine.map((c: ResolvedCell) => `${c.hour} ${c.studentName}`).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">{r.mine.length}</td>
                    <td className="px-3 py-3 text-center text-[#34C759] font-medium">{r.hadir}</td>
                    <td className="px-3 py-3 text-center text-blue-400">{r.waiting}</td>
                    <td className="px-3 py-3 text-center">{r.needRecord === 0 ? '—' : `${r.done}/${r.needRecord}`}</td>
                    <td className={`px-3 py-3 text-center font-semibold ${r.backlog.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{r.backlog.length}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remind(r.t.therapist_id)}
                        disabled={reminding !== null || r.backlog.length === 0}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-40 cursor-pointer"
                      >
                        {reminding === r.t.therapist_id ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Ingatkan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Belum Diisi (7 hari terakhir)</h2>
          <p className="text-xs text-muted-foreground">Terapi Awal dan rekam medis anak yang sudah hadir tapi belum diselesaikan.</p>
        </div>
        {records.pending.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Semua rekam medis sudah lengkap.</p>
        ) : (
          <div className="divide-y divide-border">
            {records.pending.map((p) => (
              <div key={p.visitId} className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-sm">
                <span className="w-14 text-xs text-muted-foreground shrink-0">{fmt(p.visitDate)}</span>
                <span className="font-medium text-foreground flex-1 min-w-[140px] truncate">{p.patientName}</span>
                <span className="text-xs text-muted-foreground">{nameOf(p.staffId)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {p.kind === 'terapi-awal' ? 'Terapi Awal' : 'Rekam Medis'} · {p.state === 'draft' ? 'Draf' : 'Belum diisi'}
                </span>
                <button onClick={() => openRecord(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer" title="Buka">
                  <ExternalLink size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
