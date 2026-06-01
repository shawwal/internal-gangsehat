'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CalendarOff, CalendarRange, CheckCircle2, Clock,
  FileText, PlusCircle, Upload, X, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProofDialog } from '@/components/leave/ProofDialog'

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

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
]

const today = new Date().toISOString().split('T')[0]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dayCount(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
}

export default function MyLeavePage() {
  const [requests, setRequests]       = useState<LeaveRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<FilterTab>('all')
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState({ start_date: today, end_date: today, reason: '' })
  const [proofFile, setProofFile]     = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState('')
  const [saving, setSaving]           = useState(false)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

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
  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview) }, [proofPreview])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    setProofFile(file)
    setProofPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : '')
  }

  function clearProof() {
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    setProofFile(null)
    setProofPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function closeForm() {
    setShowForm(false)
    setForm({ start_date: today, end_date: today, reason: '' })
    clearProof()
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (form.end_date < form.start_date) {
      showToast('Tanggal akhir tidak boleh sebelum tanggal mulai.', false)
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
        showToast('Gagal mengunggah bukti. Coba lagi.', false)
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
      showToast('Gagal mengajukan cuti.', false)
    } else {
      showToast('Pengajuan cuti berhasil dikirim!', true)
      closeForm()
      load()
    }
  }

  const pendingCount  = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length
  const filtered = activeTab === 'all' ? requests : requests.filter(r => r.status === activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pengajuan Cuti</h1>
          <p className="text-sm text-muted-foreground">Ajukan dan pantau status cuti Anda</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
        >
          <PlusCircle size={15} />
          {showForm ? 'Tutup Form' : 'Ajukan Cuti'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
          toast.ok
            ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Form Pengajuan Cuti</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Isi data di bawah dan klik kirim</p>
            </div>
            <button
              onClick={closeForm}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Tanggal Mulai</label>
                <input
                  required type="date"
                  value={form.start_date}
                  min={today}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Tanggal Selesai</label>
                <input
                  required type="date"
                  value={form.end_date}
                  min={form.start_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Duration hint */}
            {form.start_date && form.end_date && form.end_date >= form.start_date && (
              <div className="flex items-center gap-2 text-xs text-primary font-medium">
                <CalendarRange size={13} />
                {dayCount(form.start_date, form.end_date)} hari cuti
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Alasan</label>
              <textarea
                required rows={3}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Jelaskan alasan pengajuan cuti Anda..."
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* File upload */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Surat Sakit / Bukti
                <span className="ml-1 text-muted-foreground font-normal">(opsional)</span>
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
                <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-muted/30">
                  {proofPreview ? (
                    <img src={proofPreview} alt="Preview"
                      className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{proofFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(proofFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    type="button" onClick={clearProof}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="proof-upload"
                  className="flex items-center gap-4 px-4 py-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                    <Upload size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Unggah surat sakit atau bukti</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, PDF · Maks. 5 MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button" onClick={closeForm}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Batal
              </button>
              <button
                type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse bg-muted rounded-3xl h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <CalendarOff size={17} className="text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{requests.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
              <Clock size={17} className="text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{pendingCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Menunggu</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-chart-4/15 flex items-center justify-center shrink-0">
              <CheckCircle2 size={17} className="text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{approvedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Disetujui</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <XCircle size={17} className="text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{rejectedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Ditolak</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {!loading && requests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-muted rounded-3xl h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarOff size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {activeTab === 'all' ? 'Belum ada pengajuan cuti' : `Tidak ada cuti "${STATUS_LABEL[activeTab]}"`}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {activeTab === 'all'
              ? 'Klik "Ajukan Cuti" untuk memulai pengajuan pertama Anda.'
              : 'Coba pilih tab filter yang lain.'}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle size={14} /> Ajukan Cuti
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div
              key={r.id}
              className={`glass-card border-l-4 ${STATUS_BORDER[r.status]} p-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Date row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <CalendarRange size={13} className="text-muted-foreground shrink-0" />
                    <p className="text-sm font-semibold text-foreground">
                      {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    </p>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {dayCount(r.start_date, r.end_date)} hari
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-foreground leading-relaxed">{r.reason}</p>

                  {/* Proof */}
                  {r.proof_url && <ProofDialog url={r.proof_url} />}

                  {/* Rejection note */}
                  {r.rejection_note && (
                    <div className="flex items-start gap-2 mt-1 p-2.5 rounded-xl bg-destructive/5 border border-destructive/20">
                      <XCircle size={13} className="text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive leading-relaxed">{r.rejection_note}</p>
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[r.status]}`}>
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
