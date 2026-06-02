'use client'

import { Wallet, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { PayrollCard } from './PayrollCard'
import type { PayrollRecord } from './types'
import { PAGE_SIZE } from './types'

interface Props {
  records: PayrollRecord[]
  loading: boolean
  isManager: boolean
  page: number
  total: number
  onPageChange: (page: number) => void
  onConfirm: (id: string) => Promise<void>
  onMarkPaid: (id: string) => Promise<void>
  onEdit: (r: PayrollRecord) => void
  onDelete: (id: string) => Promise<void>
}

export function PayrollList({
  records,
  loading,
  isManager,
  page,
  total,
  onPageChange,
  onConfirm,
  onMarkPaid,
  onEdit,
  onDelete,
}: Props) {
  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="glass-card p-10 text-center space-y-2">
        <Wallet size={32} className="mx-auto text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Belum ada record penggajian</p>
        <p className="text-xs text-muted-foreground">
          {isManager
            ? 'Belum ada data penggajian untuk periode ini.'
            : 'Klik "Generate Penggajian" untuk membuat draft record bulan ini.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {records.map(r => (
          <PayrollCard
            key={r.id}
            record={r}
            isManager={isManager}
            onConfirm={!isManager ? onConfirm : undefined}
            onMarkPaid={!isManager ? onMarkPaid : undefined}
            onEdit={onEdit}
            onDelete={!isManager ? onDelete : undefined}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} dari {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="p-2 rounded-xl border border-border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-xl border border-border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
