'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Home, MapPin, Package, Plus, RotateCcw, Search } from 'lucide-react'
import { useGriyaBranch } from '@/hooks/useGriyaBranch'
import { useToast } from '@/context/ToastContext'
import { fetchGriyaHomeVisits, type GriyaHomeVisitRow, type GriyaHomeVisitStats } from '@/app/actions/griyaHomeVisit'
import { markVisitAttendance, resetVisitAttendance } from '@/app/actions/griyaJadwal'
import { GriyaHomeVisitDialog, type GriyaHomeVisitCreated } from '@/components/griya/homeVisit/GriyaHomeVisitDialog'
import { SessionNoteModal, type SessionNoteTarget } from '@/components/griya/SessionNoteModal'
import { PaymentDialog, type PaymentVisitInfo } from '@/components/visits/PaymentDialog'
import { DISCIPLINE_LABEL, toIso } from '@/components/griya/constants'
import { inputCls } from '@/components/griya/StudentFormFields'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { MONTH_NAMES } from '@/lib/payroll/period'
import GriyaHomeVisitLoading from './loading'

const SERVICE_LABEL: Record<string, string> = {
  'TERAPI AWAL VISIT': 'Terapi Awal Visit',
  'SESI VISIT': 'Sesi Visit',
  'PAKET VISIT': 'Paket Visit',
}

const EMPTY_STATS: GriyaHomeVisitStats = { total: 0, hadir: 0, unpaid: 0, recordsOpen: 0 }

function monthRange(year: number, month: number) {
  return { from: toIso(new Date(year, month - 1, 1)), to: toIso(new Date(year, month, 0)) }
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

export default function GriyaHomeVisitPage() {
  const { loading, branchId, role, enabled, canEdit } = useGriyaBranch()
  const { showToast } = useToast()
  const now = new Date()
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<GriyaHomeVisitRow[]>([])
  const [stats, setStats] = useState<GriyaHomeVisitStats>(EMPTY_STATS)
  const [dataLoading, setDataLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState<PaymentVisitInfo | null>(null)
  const [noteTarget, setNoteTarget] = useState<SessionNoteTarget | null>(null)

  const range = useMemo(() => monthRange(ym.year, ym.month), [ym])

  const load = useCallback(async () => {
    if (!branchId) return
    setDataLoading(true)
    const res = await fetchGriyaHomeVisits({ branchId, ...range, search })
    setRows(res.rows)
    setStats(res.stats)
    setDataLoading(false)
  }, [branchId, range, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  function shiftMonth(delta: number) {
    setYm(({ year, month }) => {
      const d = new Date(year, month - 1 + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
  }

  async function attendance(row: GriyaHomeVisitRow, action: 'hadir' | 'tidak' | 'reset') {
    setBusy(row.id)
    const res = action === 'reset'
      ? await resetVisitAttendance(row.id)
      : await markVisitAttendance(row.id, { present: action === 'hadir' })
    setBusy(null)
    if (res.error) { showToast(res.error, 'error'); return }
    load()
  }

  function openPayment(row: Pick<GriyaHomeVisitRow, 'id' | 'patient_id' | 'patient_name' | 'visit_date' | 'service_type' | 'layanan_id' | 'therapist_name'>) {
    setPaying({
      id: row.id,
      patient_id: row.patient_id,
      patient_name: row.patient_name,
      visit_date: row.visit_date,
      service_type: row.service_type,
      branch_id: branchId,
      layanan_id: row.layanan_id,
      attending_staff_name: row.therapist_name ?? undefined,
    })
  }

  function onCreated(c: GriyaHomeVisitCreated) {
    setCreating(false)
    showToast('Home visit tersimpan dan masuk ke Jadwal Griya Anak', 'success')
    // Jump to the visit's month so the new row is visible.
    const d = new Date(c.visit_date + 'T00:00:00')
    setYm({ year: d.getFullYear(), month: d.getMonth() + 1 })
    load()
    if (c.needsPayment && canEdit) {
      openPayment({ ...c, therapist_name: c.therapist_name })
    }
  }

  function openRecord(row: GriyaHomeVisitRow) {
    if (row.record.route === 'terapi-awal') {
      window.open(`/griya-anak/siswa/${row.patient_id}/terapi-awal/${row.id}`, '_blank', 'noopener,noreferrer')
    } else if (row.record.route === 'session-note') {
      setNoteTarget({ visitId: row.id, patientId: row.patient_id, patientName: row.patient_name, branchId: branchId!, griyaSlotId: null })
    }
  }

  if (loading) return <GriyaHomeVisitLoading />
  if (!branchId || !enabled) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>
  }

  const statCards = [
    { label: 'Kunjungan', value: stats.total },
    { label: 'Hadir', value: stats.hadir },
    { label: 'Belum dibayar', value: stats.unpaid, warn: stats.unpaid > 0 },
    { label: 'Rekam medis belum lengkap', value: stats.recordsOpen, warn: stats.recordsOpen > 0 },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Home size={20} className="text-primary mt-0.5" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Home Visit Griya Anak</h1>
            <p className="text-sm text-muted-foreground">
              {role === 'therapist' ? 'Kunjungan rumah yang ditugaskan ke Anda' : 'Kunjungan terapi ke rumah anak — jadwal, kehadiran, pembayaran, dan rekam medis'}
            </p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer">
            <Plus size={14} /> Home Visit Baru
          </button>
        )}
      </div>

      <div className="glass-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-xl border border-border hover:bg-muted cursor-pointer" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={15} /></button>
          <p className="px-3 text-sm font-semibold text-foreground min-w-[130px] text-center">{MONTH_NAMES[ym.month - 1]} {ym.year}</p>
          <button className="p-2 rounded-xl border border-border hover:bg-muted cursor-pointer" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya"><ChevronRight size={15} /></button>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama anak…" className={`${inputCls} pl-9`} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className={`text-2xl font-bold ${s.warn ? 'text-destructive' : 'text-foreground'}`}>{dataLoading ? '–' : s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {dataLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : rows.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          Belum ada home visit di {MONTH_NAMES[ym.month - 1]} {ym.year}.
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                <th className="px-4 py-3 text-left font-medium">Anak</th>
                <th className="px-4 py-3 text-left font-medium">Terapis</th>
                <th className="px-4 py-3 text-left font-medium">Layanan</th>
                <th className="px-4 py-3 text-left font-medium">Kehadiran</th>
                <th className="px-4 py-3 text-left font-medium">Pembayaran</th>
                <th className="px-4 py-3 text-left font-medium">Rekam Medis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cancelled = r.status === 'cancelled' && r.kehadiran !== 'TIDAK HADIR'
                return (
                  <tr key={r.id} className={`border-b border-border/50 last:border-0 align-top ${cancelled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-foreground">{fmtDate(r.visit_date)}</p>
                      <p className="text-xs text-muted-foreground">{r.visit_time ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/griya-anak/siswa/${r.patient_id}`} className="font-medium text-foreground hover:text-primary">{r.patient_name}</Link>
                      {r.no_rm && <p className="text-xs text-muted-foreground">No. Rekam Medis {r.no_rm}</p>}
                      {r.patient_address && (
                        <p className="text-xs text-muted-foreground flex items-start gap-1 max-w-[220px]"><MapPin size={11} className="shrink-0 mt-0.5" />{r.patient_address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{r.therapist_name ?? '—'}</p>
                      {r.discipline && <p className="text-xs text-muted-foreground">{DISCIPLINE_LABEL[r.discipline]}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{SERVICE_LABEL[r.service_type] ?? r.service_type}</p>
                      {r.package ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Package size={11} /> {r.package.name} · {r.package.used}/{r.package.total}</p>
                      ) : r.layanan_name && <p className="text-xs text-muted-foreground">{r.layanan_name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {r.kehadiran === 'HADIR' ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-chart-4/15 text-chart-4">Hadir</span>
                      ) : r.kehadiran === 'TIDAK HADIR' ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Tidak hadir</span>
                      ) : cancelled ? (
                        <span className="text-xs text-muted-foreground">Dibatalkan</span>
                      ) : canEdit ? (
                        <div className="flex gap-1">
                          <button disabled={busy === r.id} onClick={() => attendance(r, 'hadir')}
                            className="text-xs px-2 py-1 rounded-lg border border-chart-4/40 text-chart-4 hover:bg-chart-4/10 disabled:opacity-50 cursor-pointer">Hadir</button>
                          <button disabled={busy === r.id} onClick={() => attendance(r, 'tidak')}
                            className="text-xs px-2 py-1 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer">Tidak hadir</button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Terjadwal</span>
                      )}
                      {canEdit && r.kehadiran && (
                        <button disabled={busy === r.id} onClick={() => attendance(r, 'reset')} title="Batalkan penandaan"
                          className="ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer align-middle"><RotateCcw size={12} /></button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.package ? (
                        <span className={`text-xs ${r.package.paid ? 'text-chart-4' : r.package.deposit ? 'text-secondary' : 'text-destructive'}`}>{r.package.paid ? 'Paket lunas' : r.package.deposit ? 'Paket belum lunas (DP)' : 'Paket belum dibayar'}</span>
                      ) : r.payment ? (
                        r.payment.outstanding > 0
                          ? <span className="text-xs text-secondary-foreground">{r.payment.status ?? 'DP'} · sisa {rp(r.payment.outstanding)}</span>
                          : <span className="text-xs text-chart-4">Lunas</span>
                      ) : canEdit && r.status !== 'cancelled' ? (
                        <button onClick={() => openPayment(r)} className="text-xs px-2 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">Catat bayar</button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!r.record.route || r.status === 'cancelled' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <button onClick={() => openRecord(r)}
                          className={`text-xs px-2 py-1 rounded-lg border cursor-pointer ${
                            r.record.status === 'completed' ? 'border-chart-4/40 text-chart-4' : r.record.status === 'draft' ? 'border-secondary/50 text-secondary-foreground' : 'border-border text-foreground hover:bg-muted'
                          }`}>
                          {r.record.status === 'completed' ? 'Lengkap' : r.record.status === 'draft' ? 'Lanjutkan' : 'Isi'}
                          {' '}{r.record.route === 'terapi-awal' ? 'Terapi Awal' : 'Catatan Sesi'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <GriyaHomeVisitDialog branchId={branchId} onClose={() => setCreating(false)} onSaved={onCreated} />}
      {paying && (
        <PaymentDialog visit={paying} onClose={() => setPaying(null)} onSuccess={() => { setPaying(null); load() }} />
      )}
      {noteTarget && (
        <SessionNoteModal target={noteTarget} onClose={() => setNoteTarget(null)} onSaved={() => { setNoteTarget(null); load() }} />
      )}
    </div>
  )
}
