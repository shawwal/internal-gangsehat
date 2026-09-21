'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search, Users, CalendarCheck, CalendarClock, FilePen, Phone, MessageCircle, ChevronRight, RefreshCw, X,
} from 'lucide-react'
import { useGriyaBranch } from '@/hooks/useGriyaBranch'
import { fetchMyGriyaStudents, type MyStudent } from '@/app/actions/griyaMyStudents'
import { DISCIPLINE_COLOR, DISCIPLINE_LABEL, DISCIPLINES, HARI_LABEL } from '@/components/griya/constants'
import { GENDER_LABEL, calcAge } from '@/components/patients/detail/constants'
import { formatWaNumber } from '@/lib/utils'
import type { Discipline } from '@/app/actions/griyaJadwal'

type StatusFilter = 'all' | MyStudent['status']
type SortKey = 'name' | 'last' | 'sessions' | 'next'

const PAGE_SIZE = 12
const STATUS_LABEL: Record<MyStudent['status'], string> = { active: 'Aktif', graduated: 'Lulus', inactive: 'Nonaktif' }
const STATUS_CLS: Record<MyStudent['status'], string> = {
  active: 'bg-[#34C759]/15 text-[#34C759]',
  graduated: 'bg-primary/15 text-primary',
  inactive: 'bg-muted text-muted-foreground',
}
const SORT_LABEL: Record<SortKey, string> = {
  name: 'Nama A–Z',
  last: 'Terakhir hadir',
  sessions: 'Sesi terbanyak',
  next: 'Jadwal terdekat',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function relDays(iso: string | null, today: string) {
  if (!iso) return null
  const diff = Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000)
  if (diff === 0) return 'hari ini'
  if (diff === 1) return 'besok'
  if (diff === -1) return 'kemarin'
  return diff > 0 ? `${diff} hari lagi` : `${-diff} hari lalu`
}

export default function GriyaMySiswaPage() {
  const { loading: gateLoading, branchId, enabled } = useGriyaBranch()
  const [students, setStudents] = useState<MyStudent[]>([])
  const [today, setToday] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [discipline, setDiscipline] = useState<Discipline | 'all'>('all')
  const [onlyPending, setOnlyPending] = useState(false)
  const [sort, setSort] = useState<SortKey>('name')
  const [shown, setShown] = useState(PAGE_SIZE)

  async function load() {
    setLoading(true); setError(null)
    const r = await fetchMyGriyaStudents()
    setStudents(r.students); setToday(r.today); setError(r.error ?? null)
    setLoading(false)
  }
  useEffect(() => { if (branchId && enabled) load() }, [branchId, enabled])
  useEffect(() => { setShown(PAGE_SIZE) }, [search, status, discipline, onlyPending, sort])

  const stats = useMemo(() => ({
    active: students.filter((s) => s.status === 'active').length,
    total: students.length,
    month: students.reduce((n, s) => n + s.sessionsMonth, 0),
    pending: students.reduce((n, s) => n + s.pendingRecords, 0),
  }), [students])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = students.filter((s) =>
      (status === 'all' || s.status === status) &&
      (discipline === 'all' || s.disciplines.includes(discipline)) &&
      (!onlyPending || s.pendingRecords > 0) &&
      (!q || s.name.toLowerCase().includes(q) || (s.keluhan ?? '').toLowerCase().includes(q)),
    )
    const byName = (a: MyStudent, b: MyStudent) => a.name.localeCompare(b.name, 'id')
    return list.sort((a, b) => {
      if (sort === 'last') return (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') || byName(a, b)
      if (sort === 'sessions') return b.sessionsTotal - a.sessionsTotal || byName(a, b)
      if (sort === 'next') {
        if (!a.nextVisit && !b.nextVisit) return byName(a, b)
        if (!a.nextVisit) return 1
        if (!b.nextVisit) return -1
        return a.nextVisit.localeCompare(b.nextVisit) || byName(a, b)
      }
      return byName(a, b)
    })
  }, [students, search, status, discipline, onlyPending, sort])

  const hasFilter = search !== '' || status !== 'active' || discipline !== 'all' || onlyPending
  function resetFilters() { setSearch(''); setStatus('active'); setDiscipline('all'); setOnlyPending(false) }

  if (gateLoading) return <div className="text-sm text-muted-foreground">Memuat...</div>
  if (!branchId || !enabled) return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
    }`

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Siswa Saya</h1>
          <p className="text-sm text-muted-foreground">Anak-anak yang pernah Anda tangani</p>
        </div>
        <button onClick={load} disabled={loading} aria-label="Muat ulang"
          className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 cursor-pointer">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Siswa aktif" value={stats.active} sub={`${stats.total} total ditangani`} />
        <StatCard icon={CalendarCheck} label="Sesi bulan ini" value={stats.month} sub="kehadiran tercatat" />
        <StatCard icon={FilePen} label="Rekam medis belum" value={stats.pending} sub="perlu diselesaikan"
          tone={stats.pending > 0 ? 'warn' : undefined}
          onClick={stats.pending > 0 ? () => { setOnlyPending(true); setStatus('all') } : undefined} />
        <StatCard icon={CalendarClock} label="Terjadwal" value={students.filter((s) => s.nextVisit).length} sub="punya sesi mendatang" />
      </div>

      <div className="space-y-2.5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau keluhan..."
            className="w-full pl-8 pr-9 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Chips scroll horizontally on phones instead of wrapping into a tall block. */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(['active', 'graduated', 'inactive', 'all'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {s === 'all' ? 'Semua' : STATUS_LABEL[s]}
            </button>
          ))}
          <span className="w-px h-5 bg-border shrink-0" />
          <button onClick={() => setOnlyPending((v) => !v)} className={chip(onlyPending)}>Rekam medis belum</button>
        </div>

        <div className="flex items-center gap-2">
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline | 'all')}
            className="flex-1 min-w-0 px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="all">Semua terapi</option>
            {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="flex-1 min-w-0 px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{loading ? 'Memuat...' : `${filtered.length} siswa`}</span>
        {hasFilter && <button onClick={resetFilters} className="text-primary hover:underline cursor-pointer">Reset filter</button>}
      </div>

      {error && <div className="glass-card p-4 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 animate-pulse">
          {[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-3xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          {students.length === 0 ? 'Belum ada siswa yang Anda tangani.' : 'Tidak ada siswa yang cocok dengan filter.'}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, shown).map((s) => <StudentCard key={s.patientId} s={s} today={today} />)}
          </div>
          {filtered.length > shown && (
            <button onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
              Tampilkan lebih banyak ({filtered.length - shown})
            </button>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, tone, onClick }: {
  icon: typeof Users; label: string; value: number; sub: string; tone?: 'warn'; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`glass-card p-3.5 text-left ${onClick ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}`}>
      <div className={`flex items-center gap-1.5 text-xs ${tone === 'warn' ? 'text-[#FFB35C]' : 'text-muted-foreground'}`}>
        <Icon size={13} /> {label}
      </div>
      <p className={`text-2xl font-bold mt-1 ${tone === 'warn' ? 'text-[#FFB35C]' : 'text-foreground'}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
    </Tag>
  )
}

function StudentCard({ s, today }: { s: MyStudent; today: string }) {
  const age = calcAge(s.birthDate)
  const meta = [s.gender ? GENDER_LABEL[s.gender as keyof typeof GENDER_LABEL] : null, age !== '—' ? age : null].filter(Boolean).join(' · ')
  const wa = s.phone ? formatWaNumber(s.phone) : ''

  return (
    <div className={`glass-card p-4 flex flex-col gap-3 ${s.status === 'inactive' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/griya-anak/siswa/${s.patientId}`} className="min-w-0 group">
          <p className="font-semibold text-foreground truncate group-hover:text-primary">{s.name}</p>
          <p className="text-xs text-muted-foreground truncate">{meta || '—'}</p>
        </Link>
        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
      </div>

      {s.keluhan && <p className="text-xs text-muted-foreground line-clamp-2">{s.keluhan}</p>}

      {(s.disciplines.length > 0 || s.slots.length > 0) && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {s.disciplines.map((d) => (
              <span key={d} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${DISCIPLINE_COLOR[d].tint}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${DISCIPLINE_COLOR[d].dot}`} />{DISCIPLINE_LABEL[d]}
              </span>
            ))}
          </div>
          {s.slots.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Jadwal rutin: {s.slots.map((sl) => `${HARI_LABEL[sl.hari]} ${sl.time}`).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Bulan ini" value={s.sessionsMonth} />
        <Metric label="Total sesi" value={s.sessionsTotal} />
        <Metric label="Tidak hadir" value={s.missed} warn={s.missed > 0} />
      </div>

      <dl className="text-xs space-y-1">
        <Row label="Terakhir hadir" value={s.lastVisit ? `${fmtDate(s.lastVisit)} (${relDays(s.lastVisit, today)})` : 'Belum pernah'} />
        <Row label="Sesi berikutnya"
          value={s.nextVisit ? `${fmtDate(s.nextVisit)}${s.nextVisitTime ? ` · ${s.nextVisitTime}` : ''} (${relDays(s.nextVisit, today)})` : 'Belum ada'} />
        <Row label="Mulai ditangani" value={fmtDate(s.firstVisit)} />
      </dl>

      {s.pendingRecords > 0 && s.pendingHref && (
        <Link href={s.pendingHref}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#FFB35C]/15 text-[#FFB35C] text-xs font-medium hover:bg-[#FFB35C]/25 transition-colors">
          <span className="flex items-center gap-1.5"><FilePen size={13} /> {s.pendingRecords} rekam medis belum selesai</span>
          <ChevronRight size={14} />
        </Link>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        <Link href={`/griya-anak/siswa/${s.patientId}`}
          className="flex-1 text-center py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
          Detail siswa
        </Link>
        {s.phone && (
          <>
            <a href={`tel:${s.phone}`} aria-label={`Telepon orang tua ${s.name}`}
              className="p-2 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"><Phone size={14} /></a>
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp orang tua ${s.name}`}
              className="p-2 rounded-xl border border-border text-[#34C759] hover:bg-muted transition-colors"><MessageCircle size={14} /></a>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 py-2">
      <p className={`text-lg font-bold leading-none ${warn ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground text-right">{value}</dd>
    </div>
  )
}
