'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Search } from 'lucide-react'
import { fetchPatientNamesByIds } from '@/app/actions/performance'
import { formatDateShort } from './utils'

export interface KpiDetailRow {
  id: string
  patientId: string
  visitDate: string
  serviceType: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Identifies which KPI category is open (e.g. 'ta' | 'paket' | 'kunjungan' | 'visit') —
   *  used to know when to refetch, since `rows` is recomputed fresh on every render. */
  resetKey: string
  title: string
  periodLabel: string
  rows: KpiDetailRow[]
}

function openPatientVisits(patientId: string) {
  window.open(`/patients/${patientId}/visits`, '_blank', 'noopener,noreferrer')
}

export function KpiDetailModal({ open, onClose, resetKey, title, periodLabel, rows }: Props) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Standard fetch-on-open pattern (matches components/targetProgress/DetailModal.tsx).
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setSearch('')
    const patientIds = [...new Set(rows.map((r) => r.patientId))]
    fetchPatientNamesByIds(patientIds)
      .then(setNames)
      .finally(() => setLoading(false))
    // `rows` is a freshly-derived array on every render of the parent tab —
    // key off `open` + `resetKey` (which category is showing) instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetKey])

  const displayRows = useMemo(
    () => rows.map((r) => ({ ...r, patientName: names[r.patientId] ?? '' })),
    [rows, names],
  )

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return displayRows
    return displayRows.filter((r) => r.patientName.toLowerCase().includes(term))
  }, [displayRows, search])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl flex flex-col max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl bg-popover border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Detail {title}</h2>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {!loading && rows.length > 0 && (
          <div className="px-5 py-3 border-b border-border shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama pasien..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Memuat data...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? 'Tidak ada data pada periode ini' : 'Tidak ada pasien yang cocok'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  {['No.', 'Nama Pasien', 'Layanan', 'Tanggal'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/25 hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground w-10">{i + 1}</td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      <button
                        onClick={() => openPatientVisits(r.patientId)}
                        className="text-foreground hover:text-primary hover:underline underline-offset-2 cursor-pointer text-left"
                      >
                        {r.patientName || '—'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.serviceType ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateShort(r.visitDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0 text-center">
            <p className="text-xs text-muted-foreground">
              {filteredRows.length === rows.length ? `${rows.length} data` : `${filteredRows.length} dari ${rows.length} data`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
