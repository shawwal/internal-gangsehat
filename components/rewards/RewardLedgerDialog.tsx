'use client'

import { useCallback, useEffect, useState } from 'react'
import { Coins, Loader2, Plus } from 'lucide-react'
import {
  addRewardAdjustment,
  fetchPatientRewardLedger,
  type RewardBalanceRow,
  type RewardLedgerEntry,
} from '@/app/actions/rewards'
import { formatDateTime } from '@/components/patient-registrations/types'
import { ModalShell, inputCls } from './ui'

const KIND_LABEL: Record<RewardLedgerEntry['kind'], string> = {
  referral: 'Referral',
  redemption: 'Penukaran',
  adjustment: 'Penyesuaian',
}

interface Props {
  patient: RewardBalanceRow
  canAdjust: boolean
  onClose: () => void
  /** Called after an adjustment so list totals refresh. */
  onChanged: () => void
}

export function RewardLedgerDialog({ patient, canAdjust, onClose, onChanged }: Props) {
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [adjPoints, setAdjPoints] = useState('')
  const [adjNote, setAdjNote]     = useState('')
  const [adding, setAdding]       = useState(false)

  const load = useCallback(async () => {
    const res = await fetchPatientRewardLedger(patient.patientId)
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setEntries(res.entries)
  }, [patient.patientId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function addAdjustment() {
    setAdding(true)
    setError(null)
    const res = await addRewardAdjustment(patient.patientId, Number(adjPoints), adjNote)
    setAdding(false)
    if (res.error) { setError(res.error); return }
    setAdjPoints('')
    setAdjNote('')
    await load()
    onChanged()
  }

  const balance = entries.filter(e => !e.isVoid).reduce((sum, e) => sum + e.points, 0)

  return (
    <ModalShell
      onClose={onClose}
      icon={<Coins size={16} className="text-primary" />}
      title={`Poin ${patient.name}`}
      subtitle={
        <>
          {patient.referralCode && <span className="font-mono">{patient.referralCode}</span>}
          {patient.noRm && <> · RM {patient.noRm}</>}
          {' '}· saldo <span className="font-semibold text-foreground">{loading ? patient.balance : balance} poin</span>
        </>
      }
      footer={canAdjust ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Tambah penyesuaian (direktur)</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              step={1}
              value={adjPoints}
              onChange={e => setAdjPoints(e.target.value)}
              placeholder="±Poin"
              className={`${inputCls} !w-24`}
            />
            <input
              value={adjNote}
              onChange={e => setAdjNote(e.target.value)}
              placeholder="Catatan (mis. bonus, koreksi)"
              className={`${inputCls} flex-1 min-w-40 !w-auto`}
            />
            <button
              onClick={addAdjustment}
              disabled={adding || !adjPoints.trim() || !adjNote.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Plus size={14} /> {adding ? 'Menyimpan...' : 'Tambah'}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : error ? <p className="text-xs text-destructive">{error}</p> : undefined}
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Belum ada riwayat poin.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className={`rounded-xl border border-border/60 px-3 py-2.5 ${e.isVoid ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-medium text-foreground ${e.isVoid ? 'line-through' : ''}`}>
                    {KIND_LABEL[e.kind]}
                    {e.kind === 'referral' && (
                      <span className="font-normal text-muted-foreground">
                        {' '}— {e.referredName ?? 'Pasien terhapus'}
                        {e.referredNoRm && <span className="ml-1 font-mono text-xs">{e.referredNoRm}</span>}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                    {e.createdByName && ` · oleh ${e.createdByName}`}
                  </p>
                  {(e.note || e.isVoid) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.isVoid && <span className="font-medium text-destructive">Dibatalkan. </span>}
                      {e.note}
                    </p>
                  )}
                </div>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${e.points < 0 ? 'text-destructive' : 'text-primary'}`}>
                  {e.points > 0 ? '+' : ''}{e.points}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  )
}
