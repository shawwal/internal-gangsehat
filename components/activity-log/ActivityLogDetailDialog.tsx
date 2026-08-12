'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ACTIVITY_RESOURCE_TYPES, ACTION_LABEL, formatTimestamp, type ActivityLogRow } from './types'

function formatValue(v: unknown) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function ActivityLogDetailDialog({ log, onClose }: { log: ActivityLogRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const resourceLabel = ACTIVITY_RESOURCE_TYPES[log.resource_type as keyof typeof ACTIVITY_RESOURCE_TYPES] ?? log.resource_type

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <p className="text-sm font-semibold text-foreground">Detail Aktivitas</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Oleh</p>
              <p className="text-foreground font-medium">{log.actor_name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{log.actor_email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Waktu</p>
              <p className="text-foreground font-medium">{formatTimestamp(log.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Aksi</p>
              <p className="text-foreground font-medium">{ACTION_LABEL[log.action]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Jenis Data</p>
              <p className="text-foreground font-medium">{resourceLabel}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Data</p>
              <p className="text-foreground font-medium">{log.resource_label ?? '—'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Perubahan</p>
            {log.action === 'update' && log.changed_fields && log.changed_fields.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Field</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Sebelum</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Sesudah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.changed_fields.map((field) => (
                      <tr key={field} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-foreground">{field}</td>
                        <td className="px-3 py-2 text-muted-foreground break-all">{formatValue(log.old_values?.[field])}</td>
                        <td className="px-3 py-2 text-foreground break-all">{formatValue(log.new_values?.[field])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="bg-muted/50 rounded-xl p-3 text-xs text-foreground overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {JSON.stringify(log.action === 'delete' ? log.old_values : log.new_values, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
