'use client'

import { useState } from 'react'
import {
  Ban, Check, Clock, Copy, CreditCard, Mail, MapPin, Phone, RotateCcw, Trash2, Users, XCircle,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import type { AffiliateRow, AffiliateStatus } from '@/app/actions/affiliates'
import { formatDateTime } from '@/components/patient-registrations/types'

export const AFFILIATE_STATUS_LABEL: Record<AffiliateStatus, string> = {
  pending: 'Menunggu',
  approved: 'Aktif',
  rejected: 'Ditolak',
  inactive: 'Nonaktif',
}

const STATUS_COLOR: Record<AffiliateStatus, string> = {
  pending: 'bg-secondary/20 text-secondary-foreground',
  approved: 'bg-chart-4/15 text-chart-4',
  rejected: 'bg-destructive/10 text-destructive',
  inactive: 'bg-muted text-muted-foreground',
}

const STATUS_BORDER: Record<AffiliateStatus, string> = {
  pending: 'border-l-secondary',
  approved: 'border-l-chart-4',
  rejected: 'border-l-destructive',
  inactive: 'border-l-border',
}

type Action = Exclude<AffiliateStatus, 'pending'>

interface Props {
  row: AffiliateRow
  onStatus: (id: string, status: Action, note?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function AffiliateCard({ row, onStatus, onDelete }: Props) {
  const [rejecting, setRejecting]   = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [loading, setLoading]       = useState(false)
  const [confirm, setConfirm]       = useState<'inactive' | 'delete' | null>(null)
  const [copied, setCopied]         = useState(false)

  const initials = row.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

  async function run(fn: () => Promise<void>) {
    setLoading(true)
    await fn()
    setLoading(false)
  }

  function copyCode() {
    navigator.clipboard?.writeText(row.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
    <div className={`glass-card border-l-4 ${STATUS_BORDER[row.status]} p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{row.name || '—'}</p>
              <button
                onClick={copyCode}
                title="Salin kode"
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-primary hover:bg-primary/20 transition-colors"
              >
                {row.code}
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[row.status]}`}>
                {AFFILIATE_STATUS_LABEL[row.status]}
              </span>
              <button
                onClick={() => setConfirm('delete')}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Hapus afiliasi"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone size={11} /> {row.phone || '—'}
            </span>
            {row.email && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail size={11} /> {row.email}
              </span>
            )}
            {row.domisili && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={11} /> {row.domisili}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={11} /> {formatDateTime(row.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <div className="rounded-xl bg-muted/50 px-3 py-2 space-y-0.5">
          <p className="flex items-center gap-1 font-medium text-foreground"><CreditCard size={11} /> Rekening Komisi</p>
          <p className="text-muted-foreground">{row.bankName} · <span className="font-mono">{row.accountNumber || '—'}</span></p>
          <p className="text-muted-foreground">a.n. {row.accountHolder}</p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2 space-y-0.5">
          <p className="flex items-center gap-1 font-medium text-foreground"><Users size={11} /> Rujukan</p>
          <p className="text-muted-foreground">
            {row.referralCount} pendaftaran · {row.referralApproved} jadi pasien
          </p>
          {(row.pekerjaan || row.socialMedia) && (
            <p className="text-muted-foreground truncate">
              {[row.pekerjaan, row.socialMedia].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {row.motivasi && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Rencana promosi:</span> {row.motivasi}
        </p>
      )}

      {row.status === 'rejected' && row.rejectionNote && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
          Alasan ditolak: {row.rejectionNote}
        </p>
      )}

      {row.status !== 'pending' && row.reviewedAt && (
        <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
          {AFFILIATE_STATUS_LABEL[row.status]}{row.reviewerName ? ` oleh ${row.reviewerName}` : ''} · {formatDateTime(row.reviewedAt)}
        </p>
      )}

      {row.status === 'pending' && !rejecting && (
        <div className="flex gap-2 pt-1 border-t border-border/40">
          <button
            onClick={() => run(() => onStatus(row.id, 'approved'))}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Check size={14} /> {loading ? 'Memproses...' : 'Setujui'}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-60"
          >
            <XCircle size={14} /> Tolak
          </button>
        </div>
      )}

      {row.status === 'pending' && rejecting && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <textarea
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="Tulis alasan penolakan..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setRejecting(false); setRejectNote('') }}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
            >
              Batal
            </button>
            <button
              onClick={() => run(async () => {
                await onStatus(row.id, 'rejected', rejectNote.trim())
                setRejecting(false)
                setRejectNote('')
              })}
              disabled={loading || !rejectNote.trim()}
              className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Konfirmasi Tolak'}
            </button>
          </div>
        </div>
      )}

      {row.status === 'approved' && (
        <div className="flex gap-2 pt-1 border-t border-border/40">
          <button
            onClick={() => setConfirm('inactive')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
          >
            <Ban size={14} /> Nonaktifkan
          </button>
        </div>
      )}

      {row.status === 'inactive' && (
        <div className="flex gap-2 pt-1 border-t border-border/40">
          <button
            onClick={() => run(() => onStatus(row.id, 'approved'))}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-chart-4/15 text-chart-4 text-sm font-medium hover:bg-chart-4/25 transition-colors disabled:opacity-60"
          >
            <RotateCcw size={14} /> {loading ? 'Memproses...' : 'Aktifkan Kembali'}
          </button>
        </div>
      )}
    </div>

    {confirm === 'inactive' && (
      <ConfirmDialog
        title="Nonaktifkan Afiliasi"
        description={`Kode ${row.code} tidak bisa dipakai lagi di formulir pendaftaran pasien sampai diaktifkan kembali.`}
        confirmLabel="Nonaktifkan"
        loading={loading}
        onConfirm={() => run(async () => { await onStatus(row.id, 'inactive'); setConfirm(null) })}
        onCancel={() => setConfirm(null)}
      />
    )}

    {confirm === 'delete' && (
      <ConfirmDialog
        title="Hapus Afiliasi"
        description={`Afiliasi "${row.name}" (${row.code}) akan dihapus permanen. Pendaftaran pasien yang memakai kode ini tetap tersimpan.`}
        confirmLabel="Hapus"
        danger
        loading={loading}
        onConfirm={() => run(async () => { await onDelete(row.id); setConfirm(null) })}
        onCancel={() => setConfirm(null)}
      />
    )}
    </>
  )
}
