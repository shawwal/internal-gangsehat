'use client'

import { useState } from 'react'
import { UserCheck } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { setPatientReferral, type ReferralInfo } from '@/app/actions/patientReferral'

interface Props {
  patientId: string
  info: ReferralInfo
}

/** "Dirujuk oleh" picker — feeds the PFOTM Rujukan SM metric. */
export function ReferredByCard({ patientId, info }: Props) {
  const { showToast } = useToast()
  const [value, setValue] = useState(info.referredBy ?? '')
  const [saving, setSaving] = useState(false)

  async function change(next: string) {
    const prev = value
    setValue(next)
    setSaving(true)
    const res = await setPatientReferral(patientId, next || null)
    setSaving(false)
    if (res.error) {
      setValue(prev)
      showToast(res.error, 'error')
    } else {
      showToast(next ? 'Perujuk disimpan' : 'Perujuk dihapus', 'success')
    }
  }

  return (
    <div className="glass-card px-5 py-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-[180px]">
        <UserCheck size={15} className="text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Dirujuk oleh</p>
          <p className="text-[11px] text-muted-foreground">Fisioterapis yang membawa pasien ini (dihitung di PFOTM sebagai Rujukan SM)</p>
        </div>
      </div>
      <select
        value={value}
        disabled={!info.canEdit || saving}
        onChange={(e) => change(e.target.value)}
        aria-label="Dirujuk oleh"
        className="px-3 py-2 rounded-xl border border-border bg-background text-sm min-w-[220px] disabled:opacity-60"
      >
        <option value="">— Bukan rujukan fisioterapis —</option>
        {info.referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </div>
  )
}
