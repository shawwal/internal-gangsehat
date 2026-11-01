import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function GriyaHomeVisitLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={1} />
      <StatCardsSkeleton count={4} />
      <TableSkeleton rows={6} cols={7} />
    </SkeletonRegion>
  )
}
