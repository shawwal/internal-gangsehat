import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function HrSchedulesLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <StatCardsSkeleton count={4} />
      <FiltersSkeleton count={3} />
      <TableSkeleton rows={10} cols={6} />
    </SkeletonRegion>
  )
}
