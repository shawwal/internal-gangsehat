'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CheckCircle2, Clock, ExternalLink, RefreshCw, Stethoscope, Users, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGriyaJadwal } from '@/hooks/useGriyaJadwal'
import { useToast } from '@/context/ToastContext'
import { DateNav } from '@/components/jadwal/DateNav'
import { DISCIPLINE_COLOR, DISCIPLINE_LABEL, HARI_LABEL, hariOf, toIso } from '@/components/griya/constants'
import { resolveDay, type CellState, type ResolvedCell } from '@/components/griya/resolve'
import { SessionNoteModal } from '@/components/griya/SessionNoteModal'
import { getGriyaVisitFormRoute } from '@/lib/griyaVisitRouting'
import { fetchMyGriyaPendingRecords, type PendingRecord } from '@/app/actions/griyaAdminDashboard'
import Link from 'next/link'

const STATE_BADGE: Record<CellState, { label: string; cls: string }> = {
  scheduled:    { label: 'Terjadwal',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  hadir:        { label: 'Hadir',       cls: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/25' },
  izin:         { label: 'Izin/Batal',  cls: 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/25' },
  alpa:         { label: 'Tidak Hadir', cls: 'bg-destructive/15 text-destructive border-destructive/25' },
  'moved-out':  { label: 'Dipindah',    cls: 'bg-muted text-muted-foreground border-border' },
  adhoc:        { label: 'Pengganti',   cls: 'bg-primary/15 text-primary border-primary/25' },
}

export default function GriyaTherapistDashboardPage() {
  const { today, selectedDate, setSelectedDate, week, loading, enabled, branchId, reload } = useGriyaJadwal()
  const { showToast } = useToast()
  const [userId, setUserId] = useState<string | null>(null)
  const [note, setNote] = useState<ResolvedCell | null>(null)
  const [pending, setPending] = useState<PendingRecord[]>([])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const dateIso = toIso(selectedDate)
  const hari = hariOf(selectedDate)
  const todayIso = toIso(new Date())

  const loadPending = useCallback(async () => {
    setPending(await fetchMyGriyaPendingRecords(todayIso))
  }, [todayIso])
  useEffect(() => { loadPending() }, [loadPending])
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

  const stats = useMemo(() => ({
    total: mine.length,
    hadir: mine.filter((c) => c.state === 'hadir' || c.visit?.kehadiran === 'HADIR').length,
    belum: mine.filter((c) => c.state === 'scheduled').length,
    absen: mine.filter((c) => c.state === 'izin' || c.state === 'alpa').length,
  }), [mine])

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard Terapis</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            {me ? (me.nickname || me.full_name) : 'Griya Anak'}
            {me && disc && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${disc.band}`}>{DISCIPLINE_LABEL[me.discipline]}</span>
            )}
            <span>· {HARI_LABEL[hari]}, {selectedDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </p>
        </div>
        <button onClick={() => reload()} className="p-2 rounded-xl border border-border hover:bg-muted cursor-pointer text-muted-foreground" aria-label="Muat ulang">
          <RefreshCw size={14} />
        </button>
      </div>

      {pending.length > 0 && (
        <div id="belum-diisi" className="glass-card border border-destructive/30 overflow-hidden scroll-mt-20">
          <div className="px-4 py-3 border-b border-border bg-destructive/5">
            <h2 className="text-sm font-semibold text-destructive">{pending.length} rekam medis / Terapi Awal belum diselesaikan</h2>
            <p className="text-xs text-muted-foreground">Anak yang sudah hadir (7 hari terakhir) — mohon segera dilengkapi.</p>
          </div>
          <div className="divide-y divide-border">
            {pending.map((p) => (
              <div key={p.visitId} className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-sm">
                <span className="w-16 text-xs text-muted-foreground shrink-0">
                  {new Date(p.visitDate + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                </span>
                <span className="font-medium text-foreground flex-1 min-w-[140px] truncate">{p.patientName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {p.kind === 'terapi-awal' ? 'Terapi Awal' : 'Rekam Medis'} · {p.state === 'draft' ? 'Draf' : 'Belum diisi'}
                </span>
                <Link
                  href={p.kind === 'terapi-awal' ? `/griya-anak/siswa/${p.patientId}/terapi-awal/${p.visitId}` : `/griya-anak/siswa/${p.patientId}/rekam-medis`}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                >
                  Isi Sekarang
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <DateNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Anak', value: stats.total, icon: Users, color: 'bg-primary/10 text-primary' },
          { label: 'Sudah Hadir', value: stats.hadir, icon: CheckCircle2, color: 'bg-[#34C759]/10 text-[#34C759]' },
          { label: 'Menunggu', value: stats.belum, icon: Clock, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Tidak Hadir', value: stats.absen, icon: XCircle, color: 'bg-destructive/10 text-destructive' },
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card h-20 animate-pulse" />)}
        </div>
      ) : !me ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          Anda belum terdaftar sebagai terapis di jadwal Griya Anak. Hubungi admin.
        </div>
      ) : mine.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center gap-2 text-center">
          <CalendarCheck size={26} className="text-primary" />
          <p className="text-sm font-medium text-foreground">Tidak ada anak terjadwal di hari ini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mine.map((cell, i) => {
            const badge = STATE_BADGE[cell.state]
            const canRecord = !!cell.visit?.id && !cell.visit.id.startsWith('optimistic-') && cell.state !== 'izin' && cell.state !== 'alpa'
            const service = cell.visit?.service_type ?? cell.slot?.service_type
            return (
              <div key={`${cell.key}-${i}`} className="glass-card p-4 flex items-center gap-4 flex-wrap">
                <div className="w-16 shrink-0 text-center">
                  <p className="text-base font-semibold text-foreground tabular-nums">{cell.hour || '—'}</p>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-semibold text-foreground truncate">{cell.studentName}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                    {service && <span className="text-[10px] text-muted-foreground">{service}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openProfile(cell)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted cursor-pointer"
                  >
                    <ExternalLink size={13} /> Profil Anak
                  </button>
                  <button
                    onClick={() => openRecord(cell)}
                    disabled={!canRecord}
                    title={canRecord ? undefined : 'Tersedia setelah anak ditandai hadir'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Stethoscope size={13} /> Rekam Medis
                  </button>
                </div>
              </div>
            )
          })}
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
          onSaved={() => { setNote(null); showToast('Rekam periksa disimpan', 'success'); reload({ silent: true }); loadPending() }}
        />
      )}
    </div>
  )
}
