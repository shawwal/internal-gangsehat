'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, UserPlus, X, GraduationCap, RotateCcw, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveGriyaBranchId } from '@/app/actions/griyaJadwal'
import {
  fetchGriyaStudentsPage, enrollGriyaStudent, setGriyaStudentStatus, removeGriyaStudent,
  type GriyaStudentRow,
} from '@/app/actions/griyaStudents'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { GENDER_LABEL, calcAge } from '@/components/patients/detail/constants'
import { Pagination } from '@/components/leave/Pagination'
import { useToast } from '@/context/ToastContext'

const PAGE_SIZE = 15
type StatusFilter = 'all' | 'active' | 'graduated' | 'inactive'
const STATUS_LABEL: Record<string, string> = { active: 'Aktif', graduated: 'Lulus', inactive: 'Nonaktif' }
const STATUS_CLS: Record<string, string> = {
  active: 'bg-[#34C759]/15 text-[#34C759]',
  graduated: 'bg-primary/15 text-primary',
  inactive: 'bg-muted text-muted-foreground',
}

export default function GriyaSiswaPage() {
  const { showToast } = useToast()
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [canEdit, setCanEdit] = useState(false)

  const [rows, setRows] = useState<GriyaStudentRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [showEnroll, setShowEnroll] = useState(false)

  useEffect(() => {
    (async () => {
      const bid = await resolveGriyaBranchId()
      setBranchId(bid)
      if (!bid) { setEnabled(false); return }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('internal_profiles').select('role').eq('id', user!.id).single()
      setCanEdit(['director', 'manager', 'admin'].includes(profile?.role ?? ''))
      const { data: s } = await supabase.from('branch_griya_settings').select('enabled').eq('branch_id', bid).maybeSingle()
      setEnabled(profile?.role === 'director' ? true : (s?.enabled ?? false))
    })()
  }, [])

  const load = useCallback(() => {
    if (!branchId) return
    setLoading(true)
    fetchGriyaStudentsPage({ branchId, page, pageSize: PAGE_SIZE, search, status })
      .then((r) => { setRows(r.students); setTotal(r.total); setLoading(false) })
  }, [branchId, page, search, status])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, status])

  if (branchId === undefined || enabled === null) return <div className="text-sm text-muted-foreground">Memuat...</div>
  if (!branchId || !enabled) return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>

  async function act(fn: () => Promise<{ error: string | null }>, ok: string) {
    const { error } = await fn()
    if (error) showToast(error, 'error')
    else { showToast(ok, 'success'); load() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Siswa Griya Anak</h1>
          <p className="text-sm text-muted-foreground">{total} anak terdaftar</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowEnroll(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer">
            <UserPlus size={14} /> Tambah Siswa
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama anak..."
            className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        {(['all', 'active', 'graduated', 'inactive'] as StatusFilter[]).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
            }`}>
            {s === 'all' ? 'Semua' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nama</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">L/P</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Usia</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Keluhan</th>
              <th className="text-center px-4 py-2 font-medium text-muted-foreground">Jadwal</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Memuat...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Belum ada siswa.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.patient_id} className={`border-b border-border last:border-0 ${r.status === 'inactive' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 font-medium">
                  <Link href={`/griya-anak/siswa/${r.patient_id}`} className="text-foreground hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{r.gender ? GENDER_LABEL[r.gender] : '—'}</td>
                <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{calcAge(r.birthDate)}</td>
                <td className="px-4 py-2 text-muted-foreground hidden lg:table-cell max-w-xs truncate">{r.keluhan ?? '—'}</td>
                <td className="px-4 py-2 text-center">{r.activeSlots > 0 ? r.activeSlots : '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/griya-anak/siswa/${r.patient_id}`}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Lihat detail siswa"><ChevronRight size={14} /></Link>
                    {canEdit && r.status !== 'graduated' && (
                      <button onClick={() => act(() => setGriyaStudentStatus(r.patient_id, 'graduated'), 'Ditandai lulus')}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Tandai lulus"><GraduationCap size={13} /></button>
                    )}
                    {canEdit && r.status !== 'active' && (
                      <button onClick={() => act(() => setGriyaStudentStatus(r.patient_id, 'active'), 'Diaktifkan')}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Aktifkan"><RotateCcw size={13} /></button>
                    )}
                    {canEdit && (
                      <button onClick={() => { if (confirm(`Keluarkan ${r.name} dari daftar siswa?`)) act(() => removeGriyaStudent(r.patient_id), 'Dikeluarkan') }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" title="Keluarkan dari daftar"><Trash2 size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {showEnroll && branchId && (
        <EnrollDialog branchId={branchId} onClose={() => setShowEnroll(false)} onDone={() => { setShowEnroll(false); load() }} />
      )}
    </div>
  )
}

function EnrollDialog({ branchId, onClose, onDone }: { branchId: string; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PatientPlain[]>([])
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => ref.current?.focus(), 80) }, [])
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    const t = setTimeout(() => { searchPatients(term).then((r) => setResults(r.slice(0, 15))) }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function enroll(p: PatientPlain) {
    setBusy(true)
    const { error } = await enrollGriyaStudent(p.id, branchId, 'manual')
    setBusy(false)
    if (error) { showToast(error, 'error'); return }
    showToast(`${p.name} ditambahkan`, 'success')
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[80vh] flex flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tambah Siswa</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cari pasien yang sudah ada untuk dijadikan siswa Griya Anak.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nama..."
            className="w-full pl-8 pr-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex-1 overflow-y-auto mt-2 space-y-1">
          {results.map((p) => (
            <button key={p.id} disabled={busy} onClick={() => enroll(p)}
              className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted cursor-pointer disabled:opacity-50">
              {p.name}
              {p.birthDate && <span className="text-xs text-muted-foreground ml-2">{calcAge(p.birthDate)}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
