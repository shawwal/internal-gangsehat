'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AttendanceStatus } from '@/types'

interface StaffRow { id: string; full_name: string }
interface AttendanceRow { id: string; staff_id: string; date: string; status: AttendanceStatus }

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'late', 'leave', 'sick']
const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Hadir', absent: 'Absen', late: 'Terlambat', leave: 'Cuti', sick: 'Sakit',
}
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: 'bg-chart-4/15 text-chart-4',
  absent:  'bg-destructive/10 text-destructive',
  late:    'bg-secondary/20 text-secondary-foreground',
  leave:   'bg-chart-5/15 text-chart-5',
  sick:    'bg-muted text-muted-foreground',
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export default function AttendancePage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [records, setRecords] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)

  const days = daysInMonth(year, month)
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1)

  async function load() {
    const supabase = createClient()
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate   = `${year}-${String(month + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`

    const [{ data: staffData }, { data: attData }] = await Promise.all([
      supabase.from('internal_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('attendance').select('id, staff_id, date, status').gte('date', startDate).lte('date', endDate),
    ])
    setStaff((staffData ?? []) as StaffRow[])
    setRecords((attData ?? []) as AttendanceRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [year, month])

  function getStatus(staffId: string, day: number): AttendanceStatus | null {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return records.find((r) => r.staff_id === staffId && r.date === dateStr)?.status ?? null
  }

  async function setStatus(staffId: string, day: number, status: AttendanceStatus | '') {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSaving(`${staffId}-${day}`)
    const supabase = createClient()
    const existing = records.find((r) => r.staff_id === staffId && r.date === dateStr)
    if (status === '') {
      if (existing) await supabase.from('attendance').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert({ staff_id: staffId, date: dateStr, status })
    }
    setSaving(null)
    load()
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Absensi</h1>
          <p className="text-sm text-muted-foreground">Kelola kehadiran staff bulanan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-foreground w-28 text-center">{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[s]}`}>
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-border rounded-2xl overflow-hidden bg-card">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[140px]">Staff</th>
                {dayNumbers.map((d) => (
                  <th key={d} className="px-1 py-2 font-medium text-muted-foreground text-center min-w-[28px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5 font-medium text-foreground sticky left-0 bg-card border-r border-border">{s.full_name}</td>
                  {dayNumbers.map((d) => {
                    const status = getStatus(s.id, d)
                    const isSaving = saving === `${s.id}-${d}`
                    return (
                      <td key={d} className="px-0.5 py-1 text-center">
                        <select
                          value={status ?? ''}
                          disabled={isSaving}
                          onChange={(e) => setStatus(s.id, d, e.target.value as AttendanceStatus | '')}
                          className={`w-6 h-6 rounded text-center appearance-none cursor-pointer border-0 focus:outline-none focus:ring-1 focus:ring-primary text-[10px] ${
                            status ? STATUS_COLOR[status] : 'bg-muted/40 text-muted-foreground'
                          } disabled:opacity-50`}
                          title={status ? STATUS_LABEL[status] : 'Belum diisi'}
                        >
                          <option value="">—</option>
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt[0].toUpperCase()}</option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
