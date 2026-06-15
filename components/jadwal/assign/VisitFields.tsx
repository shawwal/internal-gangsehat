'use client'

import { STATUS_OPTIONS } from './constants'
import type { VisitStatus } from '@/types'

interface Props {
  visitTime: string
  setVisitTime: (v: string) => void
  chiefComplaint: string
  setChiefComplaint: (v: string) => void
  status: VisitStatus
  setStatus: (s: VisitStatus) => void
  notes: string
  setNotes: (v: string) => void
}

export function VisitFields({ visitTime, setVisitTime, chiefComplaint, setChiefComplaint, status, setStatus, notes, setNotes }: Props) {
  return (
    <>
      {/* Visit time */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Jam Kunjungan
        </label>
        <input
          type="time"
          value={visitTime}
          onChange={(e) => setVisitTime(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        />
      </div>

      {/* Chief complaint */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Keluhan Utama <span className="font-normal text-muted-foreground">(opsional)</span>
        </label>
        <input
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="Contoh: Nyeri punggung, sakit kepala..."
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Status</label>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={[
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer border',
                status === opt.value
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Catatan tambahan..."
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow resize-none"
        />
      </div>
    </>
  )
}
