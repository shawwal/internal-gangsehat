'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, CheckCircle2, Clock, ExternalLink, FileCheck2, FilePen, FileX2, RefreshCw, Stethoscope, Users, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGriyaJadwal } from '@/hooks/useGriyaJadwal'
import { useToast } from '@/context/ToastContext'
import { DateNav } from '@/components/jadwal/DateNav'
import { DISCIPLINE_COLOR, DISCIPLINE_LABEL, HARI_LABEL, hariOf, toIso } from '@/components/griya/constants'
import { resolveDay, type CellState, type ResolvedCell } from '@/components/griya/resolve'
import { SessionNoteModal } from '@/components/griya/SessionNoteModal'
import { getGriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import { fetchMyGriyaPendingRecords, fetchMyGriyaRecordStates, type PendingRecord, type RecordState } from '@/app/actions/griyaAdminDashboard'

const STATE_BADGE: Record<CellState, { label: string; cls: string }> = {
  scheduled:    { label: 'Terjadwal',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  hadir:        { label: 'Hadir',       cls: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/25' },
  izin:         { label: 'Izin/Batal',  cls: 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/25' },
  alpa:         { label: 'Tidak Hadir', cls: 'bg-destructive/15 text-destructive border-destructive/25' },
  'moved-out':  { label: 'Dipindah',    cls: 'bg-muted text-muted-foreground border-border' },
  adhoc:        { label: 'Pengganti',   cls: 'bg-primary/15 text-primary border-primary/25' },
}

const RECORD_BADGE: Record<RecordState, { label: string; cls: string; icon: typeof FileCheck2 }> = {
  done:    { label: 'Rekam medis lengkap', cls: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/30', icon: FileCheck2 },
  draft:   { label: 'Draf — belum selesai', cls: 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/30', icon: FilePen },
  missing: { label: 'Belum diisi',          cls: 'bg-destructive/15 text-destructive border-destructive/30', icon: FileX2 },
}

export default function GriyaTherapistDashboardPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, branchId, reload } = useGriyaJadwal()
  const { showToast } = useToast()
  const [userId, setUserId] = useState<string | null>(null)
  const [note, setNote] = useState<ResolvedCell | null>(null)
  const [pending, setPending] = useState<PendingRecord[]>([])
  const [states, setStates] = useState<Record<string, RecordState>>({})

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const dateIso = toIso(selectedDate)
  const hari = hariOf(selectedDate)
  const todayIso = toIso(new Date())

  const loadRecords = useCallback(async () => {
    const [p, s] = await Promise.all([fetchMyGriyaPendingRecords(todayIso), fetchMyGriyaRecordStates(dateIso)])
    setPending(p); setStates(s)
  }, [todayIso, dateIso])
  useEffect(() => { loadRecords() }, [loadRecords])
  useEffect(() => {
    if (pending.length > 0 && window.location.hash === '#belum-diisi') {
      document.getElementById('belum-diisi')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [pending.length])

  const me = useMemo(() => week.therapists.find((t) => t.therapist_id === userId) ?? null, [week.therapists, userId])

  const mine = useMemo(() => {
    if (!userId) return []
    const { cells } = resolveDay(week, dateIso)
    return [...cells.values()].flat()
      .filter((c) => c.therapistId === userId && c.state !== 'moved-out')
      .sort((a, b) => a.hour.localeCompare(b.hour))
  }, [week, dateIso, userId])

  const recordOf = (c: ResolvedCell): RecordState | null => (c.visit?.id ? states[c.visit.id] ?? null : null)

  const stats = useMemo(() => {
    const tracked = mine.map(recordOf).filter((r): r is RecordState => r !== null)
    return {
      total: mine.length,
      hadir: mine.filter((c) => c.state === 'hadir' || c.visit?.kehadiran === 'HADIR').length,
      belum: mine.filter((c) => c.state === 'scheduled').length,
      absen: mine.filter((c) => c.state === 'izin' || c.state === 'alpa').length,
      recDone: tracked.filter((r) => r === 'done').length,
      recTotal: tracked.length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, states])

  function openRecord(cell: ResolvedCell) {
    const v = cell.visit
    if (!v?.id || v.id.startsWith('optimistic-')) {
      showToast('Rekam medis bisa dibuka setelah anak ditandai hadir oleh admin.', 'info')
      return
    }
    if (getGriyaVisitFormRoute(v.service_type) === 'terapi-awal') {
      window.open(`/griya-anak/siswa/${v.patient_id}/terapi-awal/${v.id}`, '_blank', 'noopener,noreferrer')
    } else {
      setNote(cell)
    }
  }

  function openProfile(cell: ResolvedCell) {
    const pid = cell.slot?.patient_id ?? cell.visit?.patient_id
    if (pid) window.open(`/griya-anak/siswa/${pid}`, '_blank', 'noopener,noreferrer')
  }

  if (branchId === null && enabled === false) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>
  }

  const disc = me ? DISCIPLINE_COLOR[me.discipline] : null

  return (
    <div className="space-y-3 sm:space-y-4 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-foreground">Dashboard Terapis</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-x-2 gap-y-0.5 flex-wrap mt-0.5">
            <span className="font-medium text-foreground/90">{me ? (me.nickname || me.full_name) : 'Griya Anak'}</span>
            {me && disc && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${disc.band}`}>{DISCIPLINE_LABEL[me.discipline]}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {HARI_LABEL[hari]}, {selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => { reload(); loadRecords() }} className="p-2.5 rounded-xl border border-border hover:bg-muted cursor-pointer text-muted-foreground shrink-0" aria-label="Muat ulang">
          <RefreshCw size={16} />
        </button>
      </div>

      {pending.length > 0 && (
        <div id="belum-diisi" className="glass-card border border-destructive/30 overflow-hidden scroll-mt-20">
          <div className="px-4 py-3 border-b border-border bg-destructive/5">
            <h2 className="text-sm font-semibold text-destructive">{pending.length} rekam medis / Terapi Awal belum selesai</h2>
            <p className="text-xs text-muted-foreground">Anak yang sudah hadir (7 hari terakhir) — mohon segera dilengkapi.</p>
          </div>
          <div className="divide-y divide-border">
            {pending.map((p) => (
              <Link
                key={p.visitId}
                href={p.kind === 'terapi-awal' ? `/griya-anak/siswa/${p.patientId}/terapi-awal/${p.visitId}` : `/griya-anak/siswa/${p.patientId}/rekam-medis`}
                className="px-4 py-3 flex items-center gap-3 active:bg-muted/60 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{p.patientName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(p.visitDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                    {' · '}{p.kind === 'terapi-awal' ? 'Terapi Awal' : 'Rekam Medis'}{' · '}{p.state === 'draft' ? 'Draf' : 'Belum diisi'}
                  </p>
                </div>
                <span className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shrink-0">Isi</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <DateNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Anak', value: stats.total, icon: Users, color: 'bg-primary/10 text-primary' },
          { label: 'Sudah Hadir', value: stats.hadir, icon: CheckCircle2, color: 'bg-[#34C759]/10 text-[#34C759]' },
          { label: 'Menunggu', value: stats.belum, icon: Clock, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Rekam Medis', value: stats.recTotal === 0 ? '—' : `${stats.recDone}/${stats.recTotal}`, icon: FileCheck2, color: 'bg-[#FFB35C]/10 text-[#FFB35C]' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}><s.icon size={17} /></div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              <p className="text-lg font-semibold text-foreground leading-tight">{loading ? '–' : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card h-28 animate-pulse" />)}
        </div>
      ) : !me ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Anda belum terdaftar sebagai terapis di jadwal Griya Anak. Hubungi admin.
        </div>
      ) : mine.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center gap-2 text-center">
          <CalendarCheck size={26} className="text-primary" />
          <p className="text-sm font-medium text-foreground">Tidak ada anak terjadwal di hari ini</p>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {mine.map((cell, i) => {
            const badge = STATE_BADGE[cell.state]
            const rec = recordOf(cell)
            const recBadge = rec ? RECORD_BADGE[rec] : null
            const canRecord = !!cell.visit?.id && !cell.visit.id.startsWith('optimistic-') && cell.state !== 'izin' && cell.state !== 'alpa'
            const service = cell.visit?.service_type ?? cell.slot?.service_type
            const done = rec === 'done'
            return (
              <div
                key={`${cell.key}-${i}`}
                className={`glass-card p-3.5 sm:p-4 border-l-4 ${
                  done ? 'border-l-[#34C759]' : rec === 'draft' ? 'border-l-[#FFB35C]' : rec === 'missing' ? 'border-l-destructive' : 'border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 rounded-xl bg-muted/60 px-2.5 py-1.5 text-center min-w-[58px]">
                    <p className="text-sm font-semibold text-foreground tabular-nums leading-tight">{cell.hour || '—'}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-foreground leading-snug break-words">{cell.studentName}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                      {service && <span className="text-[10px] text-muted-foreground">{service}</span>}
                    </div>
                    {recBadge && (
                      <span className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${recBadge.cls}`}>
                        <recBadge.icon size={12} /> {recBadge.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => openProfile(cell)}
                    className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-border text-xs font-medium active:bg-muted hover:bg-muted cursor-pointer"
                  >
                    <ExternalLink size={14} /> Profil Anak
                  </button>
                  <button
                    onClick={() => openRecord(cell)}
                    disabled={!canRecord}
                    title={canRecord ? undefined : 'Tersedia setelah anak ditandai hadir'}
                    className={`flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      done ? 'border border-border hover:bg-muted' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    <Stethoscope size={14} /> {done ? 'Lihat / Ubah' : 'Rekam Medis'}
                  </button>
                </div>
              </div>
            )
          })}
          {stats.absen > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground px-1"><XCircle size={12} /> {stats.absen} anak tidak hadir / izin hari ini</p>
          )}
        </div>
      )}

      {note?.visit && branchId && (
        <SessionNoteModal
          target={{
            visitId: note.visit.id,
            patientId: note.visit.patient_id,
            patientName: note.studentName,
            branchId,
            griyaSlotId: note.visit.griya_slot_id,
          }}
          onClose={() => setNote(null)}
          onSaved={() => { setNote(null); showToast('Rekam periksa disimpan', 'success'); reload({ silent: true }); loadRecords() }}
        />
      )}
    </div>
  )
}
