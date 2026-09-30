import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorFinanceLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={4} />
      <TableSkeleton rows={5} cols={5} />
      <TableSkeleton rows={8} cols={6} />
    </SkeletonRegion>
  )
}
