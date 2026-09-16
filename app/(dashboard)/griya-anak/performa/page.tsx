'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trophy, Users, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useGriyaBranch } from '@/hooks/useGriyaBranch'
import { ExportMenu } from '@/components/finance/accounting/ExportMenu'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { openPrintableReport } from '@/lib/pdf-export'
import { inputCls } from '@/components/finance/accounting/shared'
import { PodiumSkeleton, TableSkeleton } from '@/components/performance/Skeletons'
import { PerformaPodium } from '@/components/griya/performa/PerformaPodium'
import { PerformaBarChart } from '@/components/griya/performa/PerformaBarChart'
import { PerformaLeaderboardTable } from '@/components/griya/performa/PerformaLeaderboardTable'
import { defaultThisMonth, defaultLastMonth } from '@/components/griya/performa/utils'
import type { TherapistPerforma, DateRangeState } from '@/components/griya/performa/types'

const presetBtnCls =
  'px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted cursor-pointer transition-colors'

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GriyaPerformaPage() {
  const { loading, branchId, enabled, canEdit } = useGriyaBranch()

  const [branchName, setBranchName] = useState('Griya Anak')
  const [range, setRange] = useState<DateRangeState>(defaultThisMonth())
  const [draftFrom, setDraftFrom] = useState(range.from)
  const [draftTo, setDraftTo] = useState(range.to)
  const [rows, setRows] = useState<TherapistPerforma[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) return
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('branches').select('name').eq('id', branchId).maybeSingle()
      if (data?.name) setBranchName(data.name)
    })()
  }, [branchId])

  const load = useCallback(async () => {
    if (!branchId) return
    setDataLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      const [rosterRes, visitsRes] = await Promise.all([
        supabase
          .from('griya_therapists')
          .select('id, therapist_id, is_active, internal_profiles!therapist_id(full_name, nickname, avatar_url)')
          .eq('branch_id', branchId)
          .eq('is_active', true),
        supabase
          .from('patient_visits')
          .select('id, attending_staff_id, kehadiran, visit_date')
          .eq('branch_id', branchId)
          .eq('kehadiran', 'HADIR')
          .gte('visit_date', range.from)
          .lte('visit_date', range.to)
          .not('attending_staff_id', 'is', null),
      ])

      if (rosterRes.error) throw rosterRes.error
      if (visitsRes.error) throw visitsRes.error

      const totals = new Map<string, number>()
      for (const v of visitsRes.data ?? []) {
        const sid = v.attending_staff_id as string
        totals.set(sid, (totals.get(sid) ?? 0) + 1)
      }

      const roster = (rosterRes.data ?? []) as Record<string, unknown>[]
      const result: TherapistPerforma[] = roster.map((t) => {
        const ip = t.internal_profiles as { full_name?: string; nickname?: string | null; avatar_url?: string | null } | null
        const therapistId = t.therapist_id as string
        return {
          therapist_id: therapistId,
          name: ip?.full_name ?? therapistId,
          nickname: ip?.nickname ?? null,
          avatar_url: ip?.avatar_url ?? null,
          total: totals.get(therapistId) ?? 0,
        }
      })

      const rosterIds = new Set(result.map((r) => r.therapist_id))
      const missingIds = [...totals.keys()].filter((sid) => !rosterIds.has(sid))
      if (missingIds.length) {
        const { data: missingProfiles } = await supabase
          .from('internal_profiles')
          .select('id, full_name, nickname, avatar_url')
          .in('id', missingIds)
        type ProfileRow = { id: string; full_name?: string; nickname?: string | null; avatar_url?: string | null }
        const profileMap = new Map(((missingProfiles ?? []) as ProfileRow[]).map((p) => [p.id, p]))
        for (const sid of missingIds) {
          const p = profileMap.get(sid)
          result.push({
            therapist_id: sid,
            name: p?.full_name ?? sid,
            nickname: p?.nickname ?? null,
            avatar_url: p?.avatar_url ?? null,
            total: totals.get(sid) ?? 0,
          })
        }
      }

      result.sort((a, b) => b.total - a.total)
      setRows(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data performa terapis.')
    } finally {
      setDataLoading(false)
    }
  }, [branchId, range])

  // Standard fetch-on-mount/param-change pattern; `load` intentionally sets
  // loading/error state before its internal await settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function applyPreset(next: DateRangeState) {
    setRange(next)
    setDraftFrom(next.from)
    setDraftTo(next.to)
  }

  function applyCustomRange() {
    setRange({ from: draftFrom, to: draftTo })
  }

  const totalSessions = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows])
  const activeTherapists = useMemo(() => rows.filter((r) => r.total > 0).length, [rows])
  const periodLabel = `${formatDateLabel(range.from)} – ${formatDateLabel(range.to)}`

  function handleExportExcel() {
    const cols: ExportColumn<TherapistPerforma>[] = [
      { header: 'Nama Terapis', value: (r) => r.nickname || r.name },
      { header: 'Total Sesi (Hadir)', value: (r) => r.total },
    ]
    exportToExcel(rows, cols, `performa_terapis_griya_${range.from}_${range.to}`)
  }

  function handleExportPdf() {
    openPrintableReport({
      title: 'Performa Terapis Griya Anak',
      subtitle: periodLabel,
      meta: [
        { label: 'Cabang', value: branchName },
        { label: 'Periode', value: periodLabel },
        { label: 'Total Sesi', value: totalSessions.toLocaleString('id-ID') },
        { label: 'Terapis Aktif', value: `${activeTherapists} dari ${rows.length}` },
      ],
      columns: [
        { header: 'Terapis', value: (r: TherapistPerforma) => r.nickname || r.name },
        { header: 'Total Sesi (Hadir)', align: 'right', value: (r: TherapistPerforma) => r.total.toLocaleString('id-ID') },
      ],
      rows,
      totalsRow: ['Total', totalSessions.toLocaleString('id-ID')],
    })
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-16 w-full rounded-2xl bg-muted" />
        <div className="h-64 w-full rounded-2xl bg-muted" />
      </div>
    )
  }
  if (!branchId || !enabled) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>
  }
  if (!canEdit) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Halaman ini hanya untuk admin, manajer, dan direktur.</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Trophy size={20} className="text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Performa Terapis Griya Anak</h1>
          <p className="text-sm text-muted-foreground">{branchName} · rekap sesi hadir untuk perhitungan gaji</p>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          <button onClick={() => applyPreset(defaultThisMonth())} className={presetBtnCls}>Bulan Ini</button>
          <button onClick={() => applyPreset(defaultLastMonth())} className={presetBtnCls}>Bulan Lalu</button>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Dari Tanggal</label>
          <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Sampai Tanggal</label>
          <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className={inputCls} />
        </div>
        <button
          onClick={applyCustomRange}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Terapkan
        </button>
        <div className="ml-auto">
          <ExportMenu onExportExcel={handleExportExcel} onExportPdf={handleExportPdf} disabled={dataLoading || !rows.length} />
        </div>
      </div>

      {error && (
        <div className="glass-card p-4 flex items-center justify-between gap-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => load()} className="text-xs font-semibold underline cursor-pointer shrink-0">Coba lagi</button>
        </div>
      )}

      {dataLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-20 rounded-2xl bg-muted animate-pulse" />
          <div className="h-20 rounded-2xl bg-muted animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-primary bg-primary/10">
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Total Sesi</p>
              <p className="text-base font-semibold text-foreground truncate">{totalSessions.toLocaleString('id-ID')}</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-chart-4 bg-chart-4/10">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Terapis Aktif</p>
              <p className="text-base font-semibold text-foreground truncate">{activeTherapists} dari {rows.length}</p>
            </div>
          </div>
        </div>
      )}

      {dataLoading ? (
        <>
          <PodiumSkeleton />
          <TableSkeleton rows={8} />
        </>
      ) : (
        <>
          <PerformaPodium top3={rows.slice(0, 3)} />
          <PerformaBarChart data={rows} />
          <PerformaLeaderboardTable rows={rows} />
        </>
      )}
    </div>
  )
}
