import type { ActivityAction, ActivityResourceType } from '@/lib/activityLog'
import { ACTIVITY_RESOURCE_TYPES } from '@/lib/activityLog'

export { ACTIVITY_RESOURCE_TYPES }

export interface ActivityLogRow {
  id: string
  user_id: string | null
  actor_name: string | null
  actor_email: string | null
  action: ActivityAction
  resource_type: ActivityResourceType | string
  resource_id: string | null
  resource_label: string | null
  branch_id: string | null
  changed_fields: string[] | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export const PAGE_SIZE = 10

export type ActionFilter = 'all' | ActivityAction
export type ResourceTypeFilter = 'all' | ActivityResourceType

export const ACTION_LABEL: Record<ActivityAction, string> = {
  create: 'Dibuat',
  update: 'Diubah',
  delete: 'Dihapus',
}

export const ACTION_COLOR: Record<ActivityAction, string> = {
  create: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]',
  update: 'bg-primary/10 text-primary',
  delete: 'bg-destructive/10 text-destructive',
}

export function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
