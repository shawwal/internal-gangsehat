'use client'

import { useEffect, useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}

const today = new Date().toISOString().split('T')[0]

export default function MyLeavePage() {
  const [requests, setRequests] = useState<LeaveRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ start_date: today, end_date: today, reason: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, reason, status, rejection_note, created_at')
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as LeaveRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
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

    const { error } = await supabase.from('leave_requests').insert({
      staff_id: user.id,
      branch_id: profile?.branch_id,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
    })

    setSaving(false)
    if (error) {
      setMessage('Gagal mengajukan cuti.')
    } else {
      setMessage('Pengajuan cuti berhasil dikirim.')
      setShowForm(false)
      setForm({ start_date: today, end_date: today, reason: '' })
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pengajuan Cuti</h1>
          <p className="text-sm text-muted-foreground">Ajukan dan pantau status cuti Anda</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle size={16} /> Ajukan Cuti
        </button>
      </div>

      {message && (
        <p className={`text-sm px-4 py-2 rounded-xl ${message.includes('berhasil') ? 'bg-chart-4/10 text-chart-4' : 'bg-destructive/10 text-destructive'}`}>
          {message}
        </p>
      )}

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Form Pengajuan Cuti</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Tanggal Mulai</label>
                <input
                  required type="date"
                  value={form.start_date}
                  min={today}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Tanggal Selesai</label>
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
              <label className="block text-xs font-medium text-foreground mb-1">Alasan</label>
              <textarea
                required rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Jelaskan alasan pengajuan cuti Anda..."
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Batal
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : !requests.length ? (
        <p className="text-sm text-muted-foreground">Belum ada pengajuan cuti.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    <span className="ml-2 text-muted-foreground font-normal">{dayCount(r.start_date, r.end_date)} hari</span>
                  </p>
                  <p className="text-sm text-foreground mt-0.5">{r.reason}</p>
                  {r.rejection_note && (
                    <p className="text-xs text-destructive mt-1">Ditolak: {r.rejection_note}</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
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
