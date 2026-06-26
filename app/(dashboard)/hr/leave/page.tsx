'use client'

import { useEffect, useState } from 'react'
import {
  CalendarOff, CalendarRange, CheckCircle2, Clock,
  Eye, FileText, Users, X, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  reason: string
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
  internal_profiles: { full_name: string; email: string } | null
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}
const STATUS_BORDER: Record<string, string> = {
  pending: 'border-l-[var(--secondary)]',
  approved: 'border-l-[var(--chart-4)]',
  rejected: 'border-l-destructive',
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ProofDisplay({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  const isPdf = /\.pdf$/i.test(url)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div className="flex items-center gap-2 mt-2">
        {isPdf ? (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setOpen(true)}>
            <FileText size={18} className="text-muted-foreground" />
          </div>
        ) : (
          <img src={url} alt="Bukti"
            className="w-10 h-10 rounded-lg object-cover border border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setOpen(true)} />
        )}
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-primary hover:underline">
          Lihat Bukti <Eye size={11} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}>
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <p className="text-sm font-semibold text-foreground">Bukti / Surat Sakit</p>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {isPdf ? (
                <iframe src={url} title="Bukti PDF"
                  className="w-full h-[70vh] rounded-xl border border-border" />
              ) : (
                <img src={url} alt="Bukti"
                  className="max-w-full max-h-[70vh] object-contain rounded-xl" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function HRLeavePage() {
  const [requests, setRequests]   = useState<LeaveRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [saving, setSaving]       = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let q = supabase
      .from('leave_requests')
      .select('id, start_date, end_date, reason, status, rejection_note, proof_url, created_at, internal_profiles!staff_id(full_name, email)')
      .order('created_at', { ascending: false })
    if (user) {
      const { data: prof } = await supabase.from('internal_profiles').select('branch_id').eq('id', user.id).single()
      if (prof?.branch_id) q = q.eq('branch_id', prof.branch_id)
    }
    const { data, error } = await q
    if (error) console.error('[hr/leave] load error:', error)
    setRequests((data ?? []) as unknown as LeaveRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function approve(id: string) {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('leave_requests')
      .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    setSaving(false)
    load()
  }

  async function reject(id: string) {
    if (!rejectNote.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        rejection_note: rejectNote.trim(),
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSaving(false)
    setRejecting(null)
    setRejectNote('')
    load()
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function dayCount(start: string, end: string) {
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
  }

  const pendingCount  = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  const filtered = activeTab === 'all' ? requests : requests.filter((r) => r.status === activeTab)

  const LEAVE_COLS: ExportColumn<LeaveRow>[] = [
    { header: 'Nama',              value: (r) => r.internal_profiles?.full_name ?? '' },
    { header: 'Email',             value: (r) => r.internal_profiles?.email ?? '' },
    { header: 'Tgl Mulai',         value: (r) => r.start_date },
    { header: 'Tgl Selesai',       value: (r) => r.end_date },
    { header: 'Jumlah Hari',       value: (r) => dayCount(r.start_date, r.end_date) },
    { header: 'Alasan',            value: (r) => r.reason },
    { header: 'Status',            value: (r) => STATUS_LABEL[r.status] },
    { header: 'Catatan Penolakan', value: (r) => r.rejection_note ?? '' },
  ]

  function handleExportLeave() {
    const today = new Date().toISOString().slice(0, 10)
    const suffix = activeTab !== 'all' ? `_${activeTab}` : ''
    exportToExcel(filtered, LEAVE_COLS, `cuti${suffix}_${today}`)
    return Promise.resolve()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pengajuan Cuti</h1>
          <p className="text-sm text-muted-foreground">Tinjau dan kelola permintaan cuti staff</p>
        </div>
        {!loading && requests.length > 0 && (
          <ExportButton onExport={handleExportLeave} />
        )}
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={requests.length} icon={<Users size={16} className="text-foreground" />} color="bg-muted" />
          <StatCard label="Menunggu" value={pendingCount} icon={<Clock size={16} className="text-secondary-foreground" />} color="bg-secondary/20" />
          <StatCard label="Disetujui" value={approvedCount} icon={<CheckCircle2 size={16} className="text-chart-4" />} color="bg-chart-4/15" />
          <StatCard label="Ditolak" value={rejectedCount} icon={<XCircle size={16} className="text-destructive" />} color="bg-destructive/10" />
        </div>
      )}

      {/* Filter tabs */}
      {!loading && requests.length > 0 && (
        <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                activeTab === tab.key
                  ? 'bg-card shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 text-xs bg-secondary/30 text-secondary-foreground px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-muted rounded-2xl h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-14 px-4 bg-muted/30 rounded-2xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarOff size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {activeTab === 'all' ? 'Belum ada pengajuan cuti' : `Tidak ada cuti "${STATUS_LABEL[activeTab]}"`}
          </p>
          <p className="text-xs text-muted-foreground">Pengajuan cuti dari staff akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const name = r.internal_profiles?.full_name ?? '—'
            return (
              <div
                key={r.id}
                className={`bg-card rounded-2xl border border-border border-l-[3px] p-4 ${STATUS_BORDER[r.status]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar name={name} />
                    <div className="flex-1 min-w-0">
                      {/* Name + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{name}</p>
                        <span className="text-xs text-muted-foreground">{r.internal_profiles?.email}</span>
                      </div>

                      {/* Date range */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <CalendarRange size={12} className="text-muted-foreground shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          {formatDate(r.start_date)} – {formatDate(r.end_date)}
                          <span className="ml-1.5 font-medium text-foreground">{dayCount(r.start_date, r.end_date)} hari</span>
                        </p>
                      </div>

                      {/* Reason */}
                      <p className="text-sm text-foreground mt-1">{r.reason}</p>

                      {/* Proof */}
                      {r.proof_url && <ProofDisplay url={r.proof_url} />}

                      {/* Rejection note */}
                      {r.rejection_note && (
                        <div className="flex items-start gap-1.5 mt-1.5">
                          <XCircle size={12} className="text-destructive mt-0.5 shrink-0" />
                          <p className="text-xs text-destructive">{r.rejection_note}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.status === 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => approve(r.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-chart-4/15 text-chart-4 text-xs font-medium hover:bg-chart-4/25 disabled:opacity-60 transition-colors"
                        >
                          <CheckCircle2 size={13} /> Setujui
                        </button>
                        <button
                          onClick={() => { setRejecting(r.id); setRejectNote('') }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                        >
                          <XCircle size={13} /> Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reject form */}
                {rejecting === r.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <label className="block text-xs font-medium text-foreground">Alasan penolakan</label>
                    <div className="flex gap-2">
                      <input
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Tuliskan alasan penolakan..."
                        className="flex-1 px-3 py-1.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={() => reject(r.id)}
                        disabled={saving || !rejectNote.trim()}
                        className="px-3 py-1.5 rounded-xl bg-destructive text-white text-xs font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors"
                      >
                        Konfirmasi
                      </button>
                      <button
                        onClick={() => setRejecting(null)}
                        className="px-3 py-1.5 rounded-xl border border-border text-xs hover:bg-muted transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
