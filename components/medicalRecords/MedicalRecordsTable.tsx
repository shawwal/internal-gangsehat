'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Loader2, Share2 } from 'lucide-react'
import type { MedicalRecordRow, RecordGroupBy } from '@/app/actions/medicalRecords'
import { missingFieldsLabel, useRecordFillHref } from './MedicalRecordCard'
import { ShareResumeDialog } from './ShareResumeDialog'
import { formatRecordDate } from './types'

interface Props {
  rows: MedicalRecordRow[]
  isTeamView: boolean
  groupBy: RecordGroupBy
  onOpenQuickForm: (visitId: string) => void
  onRemind?: (visitId: string) => void
  remindingIds: Set<string>
  remindedIds: Set<string>
}

const th = 'text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap'
const td = 'px-4 py-3 align-top'
const actionCls = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap'

/** Compact one-row-per-visit view of the same rows the cards show. */
export function MedicalRecordsTable({
  rows, isTeamView, groupBy, onOpenQuickForm, onRemind, remindingIds, remindedIds,
}: Props) {
  const [shareRecord, setShareRecord] = useState<MedicalRecordRow | null>(null)
  const colCount = isTeamView ? 7 : 5

  // Name sorts get a header row per patient / therapist, like the card list.
  const groupOf = (r: MedicalRecordRow) =>
    groupBy === 'patient' ? r.patient_id : groupBy === 'therapist' ? r.attending_staff_id : null

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Daftar rekam medis">
          <thead>
            <tr className="border-b border-border/60">
              <th className={th}>Tanggal</th>
              <th className={th}>Pasien</th>
              <th className={th}>Layanan</th>
              {isTeamView && <th className={th}>Terapis</th>}
              {isTeamView && <th className={th}>Cabang</th>}
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record, i) => {
              const group = groupOf(record)
              const showGroup = group !== null && (i === 0 || groupOf(rows[i - 1]) !== group)
              return (
                <Fragment key={record.id}>
                  {showGroup && (
                    <tr className="bg-muted/40 border-b border-border/40">
                      <td colSpan={colCount} className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {groupBy === 'patient' ? (
                          <Link href={`/patients/${record.patient_id}/visits`} className="hover:text-primary transition-colors">
                            {record.patient_name}
                          </Link>
                        ) : record.attending_staff_name}
                      </td>
                    </tr>
                  )}
                  <RecordRow
                    record={record}
                    isTeamView={isTeamView}
                    onOpenQuickForm={onOpenQuickForm}
                    onRemind={onRemind}
                    onShare={setShareRecord}
                    reminding={remindingIds.has(record.id)}
                    reminded={remindedIds.has(record.id)}
                  />
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {shareRecord && (
        <ShareResumeDialog
          visitId={shareRecord.id}
          patientName={shareRecord.patient_name}
          onClose={() => setShareRecord(null)}
        />
      )}
    </div>
  )
}

function RecordRow({ record, isTeamView, onOpenQuickForm, onRemind, onShare, reminding, reminded }: {
  record: MedicalRecordRow
  isTeamView: boolean
  onOpenQuickForm: (visitId: string) => void
  onRemind?: (visitId: string) => void
  onShare: (record: MedicalRecordRow) => void
  reminding: boolean
  reminded: boolean
}) {
  const fillHref = useRecordFillHref(record)
  const fillLabel = record.is_complete ? 'Lihat / Edit' : 'Lengkapi'
  const fillCls = `${actionCls} bg-primary/10 text-primary hover:bg-primary/20`

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
      <td className={`${td} whitespace-nowrap`}>
        <div className="text-foreground">{formatRecordDate(record.visit_date)}</div>
        {record.visit_time && <div className="text-xs text-muted-foreground">{record.visit_time}</div>}
      </td>
      <td className={td}>
        <Link
          href={`/patients/${record.patient_id}/visits`}
          className="font-medium text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
        >
          {record.patient_name}
        </Link>
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <div className="text-foreground">{record.service_type ?? '—'}</div>
        {record.pertemuan_number != null && (
          <div className="text-xs text-muted-foreground">Pertemuan {record.pertemuan_number}</div>
        )}
      </td>
      {isTeamView && <td className={`${td} whitespace-nowrap text-foreground`}>{record.attending_staff_name}</td>}
      {isTeamView && <td className={`${td} whitespace-nowrap text-muted-foreground`}>{record.branch_name || '—'}</td>}
      <td className={td}>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
          record.is_complete ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        }`}>
          {record.is_complete ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
          {record.is_complete ? 'Lengkap' : 'Belum Lengkap'}
        </span>
        {!record.is_complete && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 min-w-[120px]">
            Kurang: {missingFieldsLabel(record)}
          </div>
        )}
      </td>
      <td className={td}>
        <div className="flex items-center justify-end gap-1.5">
          {fillHref ? (
            <Link href={fillHref} className={fillCls}>
              {fillLabel} <ChevronRight size={12} />
            </Link>
          ) : (
            <button type="button" onClick={() => onOpenQuickForm(record.id)} className={`${fillCls} cursor-pointer`}>
              {fillLabel} <ChevronRight size={12} />
            </button>
          )}
          {record.is_complete && (
            <button
              type="button"
              onClick={() => onShare(record)}
              title="Kirim resume ke WhatsApp pasien"
              aria-label="Bagikan ke pasien"
              className={`${actionCls} bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer`}
            >
              <Share2 size={12} />
            </button>
          )}
          {isTeamView && !record.is_complete && onRemind && (
            <button
              type="button"
              onClick={() => onRemind(record.id)}
              disabled={reminding || reminded}
              title="Ingatkan terapis"
              className={`${actionCls} bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
            >
              {reminding ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
              {reminded ? 'Terkirim' : 'Ingatkan'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
