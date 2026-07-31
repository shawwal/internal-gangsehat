'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, ClipboardCheck } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  fetchTherapistRecordStats, fetchRecordFilterOptions, fetchMedicalRecords,
} from '@/app/actions/medicalRecords'
import type { TherapistRecordStat, RecordFilterOptions } from '@/app/actions/medicalRecords'
import { sendBulkMedicalRecordReminders } from '@/app/actions/jadwal'
import { TherapistLeaderboard } from '@/components/medicalRecords/TherapistLeaderboard'
import { PERIOD_OPTIONS } from '@/components/medicalRecords/types'
import type { RecordPeriod } from '@/app/actions/medicalRecords'

const LOW_COMPLETION_THRESHOLD = 70
const EMPTY_OPTIONS: RecordFilterOptions = { scope: 'own', isDirector: false, branches: [], staff: [] }

export default function RecordCompletionPage() {
  const { showToast } = useToast()

  const [period, setPeriod]     = useState<RecordPeriod>('30')
  const [branchId, setBranchId] = useState('all')
  const [options, setOptions]   = useState<RecordFilterOptions>(EMPTY_OPTIONS)

  const [rows, setRows]       = useState<TherapistRecordStat[]>([])
  const [loading, setLoading] = useState(true)

  const [remindingIds, setRemindingIds] = useState<Set<string>>(new Set())
  const [remindedIds, setRemindedIds]   = useState<Set<string>>(new Set())
  const [remindAllLoading, setRemindAllLoading] = useState(false)

  useEffect(() => {
    fetchRecordFilterOptions().then(setOptions)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchTherapistRecordStats({ period, branchId })
    setRows(result.rows)
    setLoading(false)
  }, [period, branchId])

  useEffect(() => { load() }, [load])

  const flagged = rows.filter((r) => r.completionRate < LOW_COMPLETION_THRESHOLD)

  async function remindTherapist(staffId: string) {
    setRemindingIds((prev) => new Set(prev).add(staffId))
    try {
      const { rows: incompleteRows } = await fetchMedicalRecords({
        page: 1, pageSize: 500,
        search: '', period, sortOrder: 'desc',
        staffId, branchId,
        completeness: 'incomplete',
      })
      const ids = incompleteRows.map((r) => r.id)
      if (ids.length === 0) { showToast('Tidak ada rekam medis yang belum lengkap', 'info'); return }

      const result = await sendBulkMedicalRecordReminders(ids)
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        setRemindedIds((prev) => new Set(prev).add(staffId))
        const parts: string[] = []
        if (result.sent > 0) parts.push(`${result.sent} terkirim`)
        if (result.skipped > 0) parts.push(`${result.skipped} sudah dikirim`)
        showToast(`Pengingat: ${parts.join(', ') || 'tidak ada yang dikirim'}`, 'success')
      }
    } finally {
      setRemindingIds((prev) => { const s = new Set(prev); s.delete(staffId); return s })
    }
  }

  async function remindAllFlagged() {
    if (flagged.length === 0) return
    setRemindAllLoading(true)
    try {
      for (const r of flagged) {
        await remindTherapist(r.staff_id)
      }
    } finally {
      setRemindAllLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
        >
          <ClipboardCheck size={18} color="white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kelengkapan Rekam Medis Tim</h1>
          <p className="text-sm text-muted-foreground">
            Pantau kelengkapan diagnosis, tindakan, dan regio per terapis
          </p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {options.isDirector && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="all">Semua Cabang</option>
              {options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as RecordPeriod)}
            className="px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {!loading && flagged.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <BellRing size={15} className="shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">{flagged.length}</span>
            {' '}terapis dengan kelengkapan rekam medis di bawah {LOW_COMPLETION_THRESHOLD}%
          </span>
          <button
            onClick={remindAllFlagged}
            disabled={remindAllLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/20 hover:bg-destructive/35 border border-destructive/40 text-destructive text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <BellRing size={12} />
            {remindAllLoading ? 'Mengirim...' : 'Ingatkan Semua yang Bermasalah'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-muted rounded-3xl h-28" />
          ))}
        </div>
      ) : (
        <TherapistLeaderboard
          rows={rows}
          isDirector={options.isDirector}
          remindingIds={remindingIds}
          remindedIds={remindedIds}
          onRemind={remindTherapist}
        />
      )}
    </div>
  )
}
