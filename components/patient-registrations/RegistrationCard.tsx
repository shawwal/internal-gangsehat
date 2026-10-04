'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Building2, Clock, ExternalLink, MapPin, Pencil, Phone, XCircle,
} from 'lucide-react'
import type { RegistrationRow } from '@/app/actions/patientRegistrations'
import {
  STATUS_BORDER, STATUS_COLOR, STATUS_LABEL, GENDER_LABEL, formatBirthDate, formatDateTime,
} from './types'

interface Props {
  row: RegistrationRow
  showBranch: boolean
  onReview: (row: RegistrationRow) => void
  onReject: (id: string, note: string) => Promise<void>
}

export function RegistrationCard({ row, showBranch, onReview, onReject }: Props) {
  const [rejecting, setRejecting]   = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [loading, setLoading]       = useState(false)

  const isPending = row.status === 'pending'
  const initials  = row.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const region    = [row.kelurahan, row.kecamatan, row.kabupatenKota].filter(Boolean).join(', ')

  async function handleReject() {
    if (!rejectNote.trim()) return
    setLoading(true)
    await onReject(row.id, rejectNote.trim())
    setLoading(false)
    setRejecting(false)
    setRejectNote('')
  }

  return (
    <div className={`glass-card border-l-4 ${STATUS_BORDER[row.status]} p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{row.name || '—'}</p>
              <p className="text-xs text-muted-foreground">
                {row.gender ? GENDER_LABEL[row.gender] : '—'} · {formatBirthDate(row.birthDate)}
              </p>
            </div>
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLOR[row.status]}`}>
              {STATUS_LABEL[row.status]}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone size={11} /> {row.phone || '—'}
            </span>
            {showBranch && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 size={11} /> {row.branchName ?? '—'}
              </span>
            )}
            {region && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={11} /> {region}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={11} /> {formatDateTime(row.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {row.keluhan && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Keluhan</p>
          <p className="text-sm text-foreground leading-relaxed">{row.keluhan}</p>
        </div>
      )}

      {isPending && row.duplicatePatientId && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/15 border border-secondary/30">
          <AlertTriangle size={14} className="text-secondary-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-foreground">
            No. HP ini sudah terdaftar pada pasien lain.{' '}
            <Link href={`/patients/${row.duplicatePatientId}`} target="_blank" className="font-medium text-primary underline">
              Lihat pasien
            </Link>
            {' '}— pastikan bukan pendaftaran ganda.
          </p>
        </div>
      )}

      {row.status === 'rejected' && row.rejectionNote && (
        <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
          <p className="text-xs font-medium text-destructive mb-1">
            Catatan Penolakan{row.reviewerName ? ` · ${row.reviewerName}` : ''}
          </p>
          <p className="text-sm text-foreground">{row.rejectionNote}</p>
        </div>
      )}

      {row.status === 'approved' && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Disetujui{row.reviewerName ? ` oleh ${row.reviewerName}` : ''}
            {row.reviewedAt ? ` · ${formatDateTime(row.reviewedAt)}` : ''}
          </p>
          {row.patientId && (
            <Link
              href={`/patients/${row.patientId}`}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Lihat Pasien <ExternalLink size={11} />
            </Link>
          )}
        </div>
      )}

      {isPending && !rejecting && (
        <div className="flex gap-2 pt-1 border-t border-border/40">
          <button
            onClick={() => onReview(row)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Pencil size={14} /> Tinjau & Setujui
          </button>
          <button
            onClick={() => setRejecting(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
          >
            <XCircle size={14} /> Tolak
          </button>
        </div>
      )}

      {isPending && rejecting && (
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
              onClick={handleReject}
              disabled={loading || !rejectNote.trim()}
              className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Konfirmasi Tolak'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
