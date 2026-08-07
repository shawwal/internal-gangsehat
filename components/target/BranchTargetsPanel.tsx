'use client'

import { Building2, PlusCircle } from 'lucide-react'
import { BranchTargetStats } from './BranchTargetStats'
import { BranchTargetFilters } from './BranchTargetFilters'
import { BranchTargetCard } from './BranchTargetCard'
import { BranchTargetForm } from './BranchTargetForm'
import { Pagination } from '@/components/leave/Pagination'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/excel-export'
import type { CategoryKey } from '@/components/targetProgress/types'
import type { BranchOption } from './types'
import { PAGE_SIZE } from './types'
import type { useBranchTargets } from './useBranchTargets'
import type { DisabledCategoryMap } from './useBranchCategorySettings'

interface Props {
  branches: BranchOption[]
  disabledCategories: DisabledCategoryMap
  state: ReturnType<typeof useBranchTargets>
}

export function BranchTargetsPanel({ branches, disabledCategories, state }: Props) {
  const {
    rows, total, stats, filters, page, loading,
    showForm, editTarget, form, saving, isManager,
    setFilters, setForm, handlePage,
    handleApprove, handleReject, handleDelete,
    openCreate, openEdit, cancelForm, handleSubmit,
  } = state

  const formBranchId = form.branchId
  const formDisabledCategories: Set<CategoryKey> | undefined =
    formBranchId ? disabledCategories[formBranchId] : undefined

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10)
    exportToExcel(rows, [
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
    ], `target_cabang_${today}`)
    return Promise.resolve()
  }

  return (
    <>
      {!showForm && (
        <div className="flex items-center justify-end gap-2">
          {!loading && rows.length > 0 && (
            <ExportButton onExport={handleExport} label="Export" />
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <PlusCircle size={15} />
            {isManager ? 'Ajukan Target Cabang' : 'Tambah Target Cabang'}
          </button>
        </div>
      )}

      {showForm && (
        <BranchTargetForm
          editTarget={editTarget}
          form={form}
          saving={saving}
          branches={branches}
          isManager={isManager}
          disabledCategories={formDisabledCategories}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancel={cancelForm}
        />
      )}

      <BranchTargetStats stats={stats} />

      <BranchTargetFilters
        filters={filters}
        branches={branches}
        pendingCount={stats.pending}
        isManager={isManager}
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
            <Building2 size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {stats.total === 0 ? 'Belum ada target cabang' : 'Tidak ada hasil yang cocok'}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {stats.total === 0
              ? isManager
                ? 'Ajukan target bulanan cabang Anda untuk disetujui direktur.'
                : 'Target bulanan dari semua cabang akan muncul di sini.'
              : 'Coba ubah filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(target => (
            <BranchTargetCard
              key={target.id}
              target={target}
              isManager={isManager}
              onApprove={!isManager ? handleApprove : undefined}
              onReject={!isManager ? handleReject : undefined}
              onDelete={!isManager ? handleDelete : undefined}
              onEdit={isManager ? openEdit : undefined}
            />
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={handlePage} />
    </>
  )
}
