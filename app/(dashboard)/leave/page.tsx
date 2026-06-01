'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CalendarOff, CalendarRange, FileText, PlusCircle,
  Upload, X, ExternalLink, Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  reason: string
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
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

const today = new Date().toISOString().split('T')[0]

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

function ProofDisplay({ url }: { url: string }) {
  const isPdf = /\.pdf$/i.test(url)
  return (
    <div className="flex items-center gap-2 mt-2">
      {isPdf ? (
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText size={18} className="text-muted-foreground" />
        </div>
      ) : (
        <img
          src={url}
          alt="Bukti"
          className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Lihat Bukti <ExternalLink size={11} />
      </a>
    </div>
  )
}

export default function MyLeavePage() {
  const [requests, setRequests] = useState<LeaveRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ start_date: today, end_date: today, reason: '' })
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, reason, status, rejection_note, proof_url, created_at')
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as LeaveRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    return () => { if (proofPreview) URL.revokeObjectURL(proofPreview) }
  }, [proofPreview])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    setProofFile(file)
    if (file.type.startsWith('image/')) {
      setProofPreview(URL.createObjectURL(file))
    } else {
      setProofPreview('')
    }
  }

  function clearProof() {
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    setProofFile(null)
    setProofPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (form.end_date < form.start_date) {
      setMessage('Tanggal akhir tidak boleh sebelum tanggal mulai.')
      setTimeout(() => setMessage(''), 4000)
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id')
      .eq('id', user.id)
      .single()

    let proofUrl: string | null = null
    if (proofFile) {
      const ext = proofFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('leave-proofs')
        .upload(path, proofFile, { upsert: false })

      if (uploadError) {
        setSaving(false)
        setMessage('Gagal mengunggah bukti. Coba lagi.')
        setTimeout(() => setMessage(''), 4000)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('leave-proofs').getPublicUrl(path)
      proofUrl = publicUrl
    }

    const { error } = await supabase.from('leave_requests').insert({
      staff_id: user.id,
      branch_id: profile?.branch_id,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
      proof_url: proofUrl,
    })

    setSaving(false)
    if (error) {
      setMessage('Gagal mengajukan cuti.')
    } else {
      setMessage('Pengajuan cuti berhasil dikirim.')
      setShowForm(false)
      setForm({ start_date: today, end_date: today, reason: '' })
      clearProof()
      load()
    }
    setTimeout(() => setMessage(''), 4000)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function dayCount(start: string, end: string) {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
    return Math.round(diff) + 1
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'pending', label: 'Menunggu' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'rejected', label: 'Ditolak' },
  ]

  const filtered = activeTab === 'all' ? requests : requests.filter((r) => r.status === activeTab)
  const pendingCount  = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pengajuan Cuti</h1>
          <p className="text-sm text-muted-foreground">Ajukan dan pantau status cuti Anda</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle size={15} /> Ajukan Cuti
        </button>
      </div>

      {/* Message */}
      {message && (
        <p className={`text-sm px-4 py-2.5 rounded-xl ${message.includes('berhasil') ? 'bg-chart-4/10 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>
          {message}
        </p>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Form Pengajuan Cuti</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Tanggal Mulai</label>
                <input
                  required type="date"
                  value={form.start_date}
                  min={today}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Tanggal Selesai</label>
                <input
                  required type="date"
                  value={form.end_date}
                  min={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Alasan</label>
              <textarea
                required rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Jelaskan alasan pengajuan cuti Anda..."
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* File upload */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Surat Sakit / Bukti <span className="text-muted-foreground font-normal">(opsional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="proof-upload"
              />
              {proofFile ? (
                <div className="flex items-center gap-3 px-3 py-3 border border-border rounded-xl bg-muted/30">
                  {proofPreview ? (
                    <img src={proofPreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm text-foreground flex-1 truncate">{proofFile.name}</span>
                  <button type="button" onClick={clearProof} className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="proof-upload"
                  className="flex items-center gap-3 px-3 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Upload size={15} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">Unggah surat sakit atau bukti</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, PDF · Maks. 5 MB</p>
                  </div>
                </label>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); clearProof() }}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      {!loading && requests.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total" value={requests.length} icon={<CalendarOff size={16} className="text-foreground" />} color="bg-muted" />
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
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-muted rounded-2xl h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-14 px-4 bg-muted/30 rounded-2xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarOff size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {activeTab === 'all' ? 'Belum ada pengajuan cuti' : `Tidak ada cuti dengan status "${STATUS_LABEL[activeTab]}"`}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {activeTab === 'all' ? 'Klik "Ajukan Cuti" untuk memulai pengajuan.' : 'Coba pilih filter lain.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`bg-card rounded-2xl border border-border border-l-[3px] p-4 ${STATUS_BORDER[r.status]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CalendarRange size={13} className="text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    </p>
                    <span className="text-xs text-muted-foreground">{dayCount(r.start_date, r.end_date)} hari</span>
                  </div>
                  <p className="text-sm text-foreground mt-1.5">{r.reason}</p>
                  {r.proof_url && <ProofDisplay url={r.proof_url} />}
                  {r.rejection_note && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <XCircle size={13} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive">{r.rejection_note}</p>
                    </div>
                  )}
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
