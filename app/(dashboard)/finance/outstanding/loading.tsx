import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function FinanceOutstandingLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <StatCardsSkeleton count={3} className="grid grid-cols-1 sm:grid-cols-3 gap-4" />
      <TableSkeleton rows={10} cols={6} />
    </SkeletonRegion>
  )
}
