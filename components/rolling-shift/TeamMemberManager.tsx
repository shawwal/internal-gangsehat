'use client'

import { useState } from 'react'
import { UserPlus, X, AlertTriangle } from 'lucide-react'
import type { ShiftTeamMember } from '@/app/actions/rollingShift'
import type { StaffOption } from './types'

interface Props {
  teamId: string
  teamName: string
  members: ShiftTeamMember[]
  staffOptions: StaffOption[]
  staffOnFlatSchedule: string[]
  saving: boolean
  onAssign: (teamId: string, staffId: string, effectiveStartDate: string) => void
  onRemove: (memberId: string, effectiveEndDate: string) => void
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TeamMemberManager({
  teamId, teamName, members, staffOptions, staffOnFlatSchedule, saving, onAssign, onRemove,
}: Props) {
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const memberIds = new Set(members.map((m) => m.staff_id))
  const available = staffOptions.filter((s) => !memberIds.has(s.id))
  const conflict = selectedStaffId && staffOnFlatSchedule.includes(selectedStaffId)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedStaffId}
          onChange={(e) => setSelectedStaffId(e.target.value)}
          className="flex-1 px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        >
          <option value="">-- Pilih staff untuk Tim {teamName} --</option>
          {available.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <button
          type="button"
          disabled={!selectedStaffId || saving}
          onClick={() => { onAssign(teamId, selectedStaffId, todayIso()); setSelectedStaffId('') }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          <UserPlus size={14} /> Tambah
        </button>
      </div>

      {conflict && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#FFB35C]/10 border border-[#FFB35C]/30 text-xs text-foreground">
          <AlertTriangle size={14} className="text-[#FFB35C] shrink-0 mt-0.5" />
          <span>Staff ini masih memiliki jadwal mingguan tetap di Master Jadwal. Menambahkannya ke tim rolling akan membuatnya berada di dua sistem sekaligus — pertimbangkan menghapus jadwal tetapnya dulu.</span>
        </div>
      )}

      <div className="space-y-1.5">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Belum ada staff di Tim {teamName}</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-border bg-muted/30">
              <span className="text-sm text-foreground">{m.staff_name}</span>
              <button
                type="button"
                onClick={() => onRemove(m.id, todayIso())}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive cursor-pointer"
                title="Keluarkan dari tim"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
