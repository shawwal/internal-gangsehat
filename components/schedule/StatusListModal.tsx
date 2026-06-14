'use client'

import { useEffect, useState } from 'react'
import { X, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ShiftBadge } from './ScheduleTable'

interface StaffGroup {
  staff_id: string
  full_name: string
  branch_name: string | null
  days: { hari: string; shift: string }[]
}

interface Props {
  open: boolean
  status: 'AKTIF' | 'OFF'
  onClose: () => void
}

const HARI_ORDER = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD']

export function StatusListModal({ open, status, onClose }: Props) {
  const [groups, setGroups]   = useState<StaffGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    if (!open) return
    setSearch('')
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status])

  async function fetchData() {
    setLoading(true)
    const { data } = await createClient()
      .from('schedules')
      .select('staff_id, hari, shift, internal_profiles!staff_id(full_name), branches!branch_id(name)')
      .eq('status', status)
      .order('hari')

    if (!data) { setLoading(false); return }

    // Group by staff_id
    const map = new Map<string, StaffGroup>()
    for (const row of data) {
      const profile = row.internal_profiles as { full_name: string } | null
      const branch  = row.branches as { name: string } | null
      if (!map.has(row.staff_id)) {
        map.set(row.staff_id, {
          staff_id:    row.staff_id,
          full_name:   profile?.full_name ?? '—',
          branch_name: branch?.name ?? null,
          days: [],
        })
      }
      map.get(row.staff_id)!.days.push({ hari: row.hari, shift: row.shift })
    }

    // Sort days within each group by canonical order
    const result = Array.from(map.values()).map((g) => ({
      ...g,
      days: g.days.sort((a, b) => HARI_ORDER.indexOf(a.hari) - HARI_ORDER.indexOf(b.hari)),
    }))
    result.sort((a, b) => a.full_name.localeCompare(b.full_name))
    setGroups(result)
    setLoading(false)
  }

  if (!open) return null

  const isOff = status === 'OFF'
  const filtered = search.trim()
    ? groups.filter((g) => g.full_name.toLowerCase().includes(search.toLowerCase()))
    : groups

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-card relative w-full sm:max-w-lg flex flex-col max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isOff ? 'bg-[#FF3B30]/10' : 'bg-[#34C759]/15'}`}>
              {isOff
                ? <XCircle size={16} className="text-[#FF3B30]" />
                : <CheckCircle2 size={16} className="text-[#34C759]" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Staff {isOff ? 'OFF' : 'Masuk'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {loading ? '...' : `${groups.length} staff`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background/60">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama staff..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Memuat data...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              {isOff
                ? <XCircle size={28} className="text-muted-foreground/40" />
                : <CheckCircle2 size={28} className="text-muted-foreground/40" />}
              <p className="text-sm text-muted-foreground">
                {search ? `Tidak ada hasil untuk "${search}"` : `Tidak ada staff dengan status ${isOff ? 'OFF' : 'MASUK'}`}
              </p>
            </div>
          ) : (
            filtered.map((g) => (
              <div
                key={g.staff_id}
                className="flex items-start gap-3 px-3 py-3 rounded-2xl border border-border bg-card/50 hover:bg-muted/30 transition-colors"
              >
                {/* Status dot */}
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isOff ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{g.full_name}</span>
                    {g.branch_name && (
                      <span className="text-xs text-muted-foreground">{g.branch_name}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {g.days.map((d) => (
                      <div key={d.hari} className="flex items-center gap-1">
                        <span className="text-xs font-medium text-foreground bg-muted px-1.5 py-0.5 rounded-lg">
                          {d.hari.slice(0, 3)}
                        </span>
                        <ShiftBadge shift={d.shift} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0 text-center">
            <p className="text-xs text-muted-foreground">
              {filtered.length} dari {groups.length} staff
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
