'use client'

import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { createBulkVisits } from '@/app/actions/jadwal'
import type { PatientPackage } from './types'

interface Props {
  pkg: PatientPackage
  patientId: string
  branchId: string | null
  onClose: () => void
  onSuccess: () => void
}

interface SessionRow {
  date: string
  shift: 'PAGI' | 'SORE' | ''
}

const inputCls = 'px-2.5 py-1.5 border border-border rounded-lg text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary w-full'

function nextWeekday(from: Date): string {
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function buildInitialSessions(count: number): SessionRow[] {
  const rows: SessionRow[] = []
  let cursor = new Date()
  for (let i = 0; i < count; i++) {
    rows.push({ date: nextWeekday(cursor), shift: 'PAGI' })
    cursor = new Date(rows[i].date)
  }
  return rows
}

export function PackageSessionWizard({ pkg, patientId, branchId, onClose, onSuccess }: Props) {
  const sessionCount = pkg.remaining_sessions
  const [sessions, setSessions] = useState<SessionRow[]>(() => buildInitialSessions(sessionCount))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const serviceType = pkg.jenis_paket?.startsWith('P')
    ? (pkg.package_name.toLowerCase().includes('visit') ? 'PAKET VISIT' : 'PAKET TERAPI')
    : 'PAKET TERAPI'

  function updateRow(i: number, patch: Partial<SessionRow>) {
    setSessions((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) { setError('Akun belum terhubung ke cabang.'); return }
    const hasEmpty = sessions.some((s) => !s.date)
    if (hasEmpty) { setError('Isi semua tanggal sesi.'); return }

    setSaving(true)
    setError(null)

    const inputs = sessions.map((s) => ({
      patient_id:         patientId,
      branch_id:          branchId,
      attending_staff_id: null,
      visit_date:         s.date,
      visit_time:         null,
      service_type:       serviceType,
      shift:              s.shift || null,
      chief_complaint:    null,
      status:             'scheduled' as const,
      notes:              null,
      package_id:         pkg.id,
    }))

    const { error: err, created } = await createBulkVisits(inputs)
    setSaving(false)
    if (err) { setError(err); return }
    if (created === 0) { setError('Tidak ada sesi yang dibuat.'); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Jadwalkan Sesi</p>
              <p className="text-xs text-muted-foreground">{pkg.package_name} · {sessionCount} sesi tersisa</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form id="session-wizard-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
          <div className="space-y-2">
            <div className="grid grid-cols-[2rem_1fr_7rem] gap-2 pb-1 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground">#</span>
              <span className="text-xs font-medium text-muted-foreground">Tanggal</span>
              <span className="text-xs font-medium text-muted-foreground">Shift</span>
            </div>
            {sessions.map((s, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_7rem] gap-2 items-center">
                <span className="text-xs text-muted-foreground text-center">{i + 1}</span>
                <input
                  required
                  type="date"
                  value={s.date}
                  onChange={(e) => updateRow(i, { date: e.target.value })}
                  className={inputCls}
                />
                <select
                  value={s.shift}
                  onChange={(e) => updateRow(i, { shift: e.target.value as 'PAGI' | 'SORE' | '' })}
                  className={inputCls}
                >
                  <option value="">—</option>
                  <option value="PAGI">PAGI</option>
                  <option value="SORE">SORE</option>
                </select>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-destructive mt-3">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="session-wizard-form"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Menyimpan...' : `Jadwalkan ${sessionCount} Sesi`}
          </button>
        </div>
      </div>
    </div>
  )
}
