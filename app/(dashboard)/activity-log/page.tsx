import { createClient } from '@/lib/supabase/server'
import { History } from 'lucide-react'
import { Suspense } from 'react'
import { ActivityLogFilters } from '@/components/activity-log/ActivityLogFilters'
import { ActivityLogTable } from '@/components/activity-log/ActivityLogTable'
import { ActivityLogPagination } from '@/components/activity-log/ActivityLogPagination'
import { PAGE_SIZE, type ActionFilter, type ResourceTypeFilter, type ActivityLogRow } from '@/components/activity-log/types'

export const dynamic = 'force-dynamic'

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; resourceType?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const action = (['create', 'update', 'delete'].includes(params.action ?? '') ? params.action : 'all') as ActionFilter
  const resourceType = (params.resourceType ?? 'all') as ResourceTypeFilter
  const page = Math.max(1, Number(params.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role, branch_id, branches!branch_id(name)')
    .eq('id', user!.id)
    .single()

  const isManager = profile?.role === 'manager'
  const branchName = (profile?.branches as unknown as { name: string } | null)?.name

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (isManager && profile?.branch_id) {
    query = query.eq('branch_id', profile.branch_id)
  }
  if (action !== 'all') {
    query = query.eq('action', action)
  }
  if (resourceType !== 'all') {
    query = query.eq('resource_type', resourceType)
  }
  if (q) {
    query = query.or(`actor_name.ilike.%${q}%,actor_email.ilike.%${q}%,resource_label.ilike.%${q}%`)
  }

  const { data: rows, count } = await query
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const baseParams: Record<string, string> = {}
  if (q) baseParams.q = q
  if (action !== 'all') baseParams.action = action
  if (resourceType !== 'all') baseParams.resourceType = resourceType

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <History size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Log Aktivitas</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {totalCount} aktivitas tercatat{isManager && branchName ? ` — Cabang ${branchName}` : ''}
        </p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <Suspense>
            <ActivityLogFilters defaultSearch={q} action={action} resourceType={resourceType} />
          </Suspense>
        </div>

        <ActivityLogTable rows={(rows ?? []) as ActivityLogRow[]} />

        <ActivityLogPagination baseParams={baseParams} page={page} totalPages={totalPages} totalCount={totalCount} />
      </div>
    </div>
  )
}
