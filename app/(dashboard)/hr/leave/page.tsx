'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
  internal_profiles: { full_name: string; email: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
}

export default function HRLeavePage() {
  const [requests, setRequests] = useState<LeaveRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await createClient()
      .from('leave_requests')
      .select('id, start_date, end_date, reason, status, rejection_note, created_at, internal_profiles(full_name, email)')
      .order('created_at', { ascending: false })
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
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
    return Math.round(diff) + 1
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pengajuan Cuti</h1>
        <p className="text-sm text-muted-foreground">Tinjau dan kelola permintaan cuti staff</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : !requests.length ? (
        <p className="text-sm text-muted-foreground">Belum ada pengajuan cuti.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{r.internal_profiles?.full_name ?? '—'}</p>
                    <span className="text-xs text-muted-foreground">{r.internal_profiles?.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    <span className="ml-2 font-medium text-foreground">{dayCount(r.start_date, r.end_date)} hari</span>
                  </p>
                  <p className="text-sm text-foreground mt-1">{r.reason}</p>
                  {r.rejection_note && (
                    <p className="text-xs text-destructive mt-1">Catatan penolakan: {r.rejection_note}</p>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => approve(r.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-chart-4/15 text-chart-4 text-xs font-medium hover:bg-chart-4/25 disabled:opacity-60 transition-colors"
                    >
                      <CheckCircle size={14} /> Setujui
                    </button>
                    <button
                      onClick={() => { setRejecting(r.id); setRejectNote('') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                    >
                      <XCircle size={14} /> Tolak
                    </button>
                  </div>
                )}
              </div>

              {rejecting === r.id && (
                <div className="mt-3 pt-3 border-t border-border flex gap-2">
                  <input
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Alasan penolakan..."
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
