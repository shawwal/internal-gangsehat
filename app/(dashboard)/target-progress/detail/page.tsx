import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/finance/attribution'
import { DetailView } from '@/components/targetProgress/DetailView'
import { CATEGORY_DEFS, EDITABLE_ROLES, isDetailSort, type CategoryKey } from '@/components/targetProgress/types'

export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Full-page list behind a Progress Target number (day cell or Capaian).
 * `?branch=&category=&start=&end=` identify the number; `q/therapist/service/payment/sort`
 * are the view's own filters, kept in the URL so Back / reload restore them.
 */
export default async function TargetProgressDetailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const def = CATEGORY_DEFS.find((d) => d.key === sp.category)
  const start = sp.start ?? ''
  const end = sp.end && ISO_DATE.test(sp.end) ? sp.end : start
  if (!def || !sp.branch || !UUID_RE.test(sp.branch) || !ISO_DATE.test(start) || end < start) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: me }, { data: branch }] = await Promise.all([
    supabase.from('internal_profiles').select('role').eq('id', user!.id).single(),
    supabase.from('branches').select('name').eq('id', sp.branch).maybeSingle(),
  ])
  if (!branch) notFound()

  return (
    <DetailView
      branchId={sp.branch}
      branchName={branch.name as string}
      category={def.key as CategoryKey}
      label={def.label}
      start={start}
      end={end}
      canEdit={(EDITABLE_ROLES as readonly string[]).includes(me?.role ?? '')}
      // Re-encoded so it can only ever be a query string for /target-progress.
      backQuery={new URLSearchParams(sp.back ?? '').toString()}
      initial={{
        q: sp.q ?? '',
        therapist: sp.therapist ?? '',
        service: sp.service ?? '',
        payment: sp.payment ?? '',
        sort: isDetailSort(sp.sort) ? sp.sort : 'date_asc',
      }}
    />
  )
}
