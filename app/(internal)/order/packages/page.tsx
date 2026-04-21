'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { PageHeader } from '@/components/internal'

type PackageRow = {
  patient_id: string
  total_points: number
  used_points: number
  patients: { encrypted_name: string; encrypted_phone: string } | null
}

const PAGE_SIZE = 10

export default function OrderPackagesPage() {
  const { t } = useTranslation()
  const [data, setData]     = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)

  async function loadData() {
    setLoading(true)
    const { data: rows } = await createClient()
      .from('patient_points')
      .select('patient_id, total_points, used_points, patients ( encrypted_name, encrypted_phone )')
      .gt('total_points', 0)
      .order('total_points', { ascending: false })

    const active = ((rows ?? []) as unknown as PackageRow[]).filter(
      (r) => r.total_points - r.used_points > 0
    )
    setData(active)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const paged      = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(data.length / PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title={t('page.order.packages_title')}
        breadcrumb={t('nav.order')}
        actions={
          <button
            onClick={loadData}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 bg-white text-gray-500"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">No.</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('col.patient_name')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">{t('col.sessions_bought')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">{t('col.sessions_used')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">{t('col.remaining_sessions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-gray-400">{t('common.loading')}</td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-gray-400">{t('page.order.packages_empty')}</td>
                </tr>
              ) : (
                paged.map((row, i) => {
                  const remaining = row.total_points - row.used_points
                  return (
                    <tr key={row.patient_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.patients?.encrypted_name ?? '—'}</p>
                        {row.patients?.encrypted_phone && (
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{row.patients.encrypted_phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.total_points}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{row.used_points}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                            remaining > 3
                              ? 'bg-green-100 text-green-700'
                              : remaining > 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {remaining}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-1 px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50"
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-2 py-1 rounded-lg border text-xs transition-colors ${
                  p === page ? 'border-[#D4A017] bg-[#D4A017] text-white' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs disabled:opacity-40 hover:bg-gray-50"
            >›</button>
          </div>
        )}
      </div>
    </div>
  )
}
