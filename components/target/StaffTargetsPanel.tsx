'use client'

import { Target } from 'lucide-react'
import { TargetStats } from './TargetStats'
import { TargetFilters } from './TargetFilters'
import { TargetCard } from './TargetCard'
import { Pagination } from '@/components/leave/Pagination'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/excel-export'
import type { BranchOption } from './types'
import { PAGE_SIZE } from './types'
import type { useStaffTargets } from './useStaffTargets'

interface Props {
  branches: BranchOption[]
  state: ReturnType<typeof useStaffTargets>
}

export function StaffTargetsPanel({ branches, state }: Props) {
  const {
    rows, total, stats, filters, page, loading,
    setFilters, handlePage, handleApprove, handleReject, handleDelete,
  } = state

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10)
    exportToExcel(rows, [
      { header: 'Nama',          value: (r) => (r as unknown as { internal_profiles: { full_name: string } }).internal_profiles?.full_name ?? '' },
      { header: 'Cabang',        value: (r) => (r as unknown as { branches: { name: string } }).branches?.name ?? '' },
      { header: 'Bulan',         value: (r) => r.bulan },
      { header: 'Tahun',         value: (r) => r.tahun },
      { header: 'Target TA',     value: (r) => r.target_ta },
      { header: 'Target Paket',  value: (r) => r.target_paket_klinik },
      { header: 'Target Kunjungan', value: (r) => r.target_kunjungan },
      { header: 'Target Visit',  value: (r) => r.target_visit },
      { header: 'Target Sesi',  value: (r) => r.target_sesi },
      { header: 'Status',        value: (r) => r.status },
      { header: 'Catatan',       value: (r) => r.notes ?? '' },
    ], `target_staff_${today}`)
    return Promise.resolve()
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <TargetStats stats={stats} />
        {!loading && rows.length > 0 && (
          <ExportButton onExport={handleExport} label="Export" />
        )}
      </div>

      <TargetFilters
        filters={filters}
        branches={branches}
        pendingCount={stats.pending}
        onChange={setFilters}
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-muted rounded-3xl h-40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Target size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {stats.total === 0 ? 'Belum ada pengajuan target' : 'Tidak ada hasil yang cocok'}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {stats.total === 0
              ? 'Target bulanan dari staff semua cabang akan muncul di sini.'
              : 'Coba ubah kata kunci pencarian atau filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(target => (
            <TargetCard
              key={target.id}
              target={target}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={handlePage} />
    </>
  )
}
