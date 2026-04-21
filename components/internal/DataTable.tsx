'use client'

import { useTranslation } from '@/hooks/useTranslation'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: Props<T>) {
  const { t } = useTranslation()
  const totalPages = Math.ceil(total / pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                  {t('common.loading')}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                  {t('common.no_data')}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className={`px-4 py-3 text-gray-700 ${col.className ?? ''}`}>
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
        <span>
          {t('common.showing')} {from}–{to} {t('common.of')} {total} {t('common.data')}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-2 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = i + 1
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`px-2 py-1 rounded-lg border transition-colors ${
                  p === page
                    ? 'border-[#D4A017] bg-[#D4A017] text-white'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            )
          })}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ›
          </button>
        </div>
        {onPageSizeChange && (
          <div className="flex items-center gap-1">
            <span>{t('common.rows_per_page')}:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-1 py-0.5 text-xs"
            >
              {[10, 25, 50].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
