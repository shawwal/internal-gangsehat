'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReportStatus } from '@/types'

interface Report {
  id: string
  period_year: number
  period_month: number
  total_income: number
  total_expense: number
  net_profit: number
  status: ReportStatus
  notes: string | null
  submitted_at: string | null
  branches: { name: string } | null
  profiles: { full_name: string } | null
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

const STATUS_BADGE: Record<ReportStatus, string> = {
  draft:     'bg-muted text-muted-foreground',
  submitted: 'bg-secondary/20 text-secondary-foreground',
  approved:  'bg-chart-4/15 text-chart-4',
  rejected:  'bg-destructive/10 text-destructive',
}

export default function DirectorReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [action, setAction]     = useState<'approved' | 'rejected' | null>(null)
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)

  async function load() {
    const { data } = await createClient()
      .from('branch_financial_reports')
      .select('*, branches(name), profiles!submitted_by(full_name)')
      .order('submitted_at', { ascending: false })
    setReports((data ?? []) as Report[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (!reviewId || !action) return
    setSaving(true)
    await createClient()
      .from('branch_financial_reports')
      .update({ status: action, notes: note || null, reviewed_at: new Date().toISOString() })
      .eq('id', reviewId)
    setSaving(false)
    setReviewId(null)
    setNote('')
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Laporan Bulanan</h1>
        <p className="text-sm text-muted-foreground">Tinjau dan setujui laporan keuangan cabang</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cabang</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Periode</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Net Profit</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{r.branches?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{MONTH_NAMES[r.period_month - 1]} {r.period_year}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.net_profit >= 0 ? 'text-chart-4' : 'text-destructive'}`}>
                    {formatRp(r.net_profit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'submitted' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setReviewId(r.id); setAction('approved'); setNote('') }}
                          className="p-1.5 rounded-lg hover:bg-chart-4/10 text-chart-4 transition-colors"
                          title="Setujui"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => { setReviewId(r.id); setAction('rejected'); setNote('') }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                          title="Tolak"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                    {r.status === 'draft' && <Clock size={14} className="text-muted-foreground ml-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reports.length && (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada laporan.</p>
          )}
        </div>
      )}

      {reviewId && action && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold text-foreground mb-1">
              {action === 'approved' ? 'Setujui Laporan' : 'Tolak Laporan'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Tambahkan catatan (opsional)</p>
            <form onSubmit={handleReview} className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Catatan..."
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewId(null)}
                  className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-colors ${action === 'approved' ? 'bg-chart-4 hover:bg-chart-4/90' : 'bg-destructive hover:bg-destructive/90'}`}
                >
                  {saving ? 'Menyimpan...' : action === 'approved' ? 'Setujui' : 'Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
