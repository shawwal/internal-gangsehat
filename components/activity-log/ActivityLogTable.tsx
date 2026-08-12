'use client'

import { useState } from 'react'
import { Eye, Inbox } from 'lucide-react'
import { ActivityLogDetailDialog } from './ActivityLogDetailDialog'
import { ACTIVITY_RESOURCE_TYPES, ACTION_LABEL, ACTION_COLOR, formatTimestamp, type ActivityLogRow } from './types'

export function ActivityLogTable({ rows }: { rows: ActivityLogRow[] }) {
  const [selected, setSelected] = useState<ActivityLogRow | null>(null)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-2">
        <Inbox size={28} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Belum ada aktivitas untuk filter ini</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Waktu</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oleh</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aksi</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jenis Data</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((log) => (
              <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(log.created_at)}</td>
                <td className="px-4 py-3">
                  <p className="text-foreground font-medium">{log.actor_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{log.actor_email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ACTION_COLOR[log.action]}`}>
                    {ACTION_LABEL[log.action]}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground/80">
                  {ACTIVITY_RESOURCE_TYPES[log.resource_type as keyof typeof ACTIVITY_RESOURCE_TYPES] ?? log.resource_type}
                </td>
                <td className="px-4 py-3 text-foreground/80 max-w-[220px] truncate">{log.resource_label ?? '—'}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => setSelected(log)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Eye size={13} /> Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <ActivityLogDetailDialog log={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
