import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function OrderLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={4} />
      <FiltersSkeleton count={3} />
      <TableSkeleton rows={10} cols={7} />
    </SkeletonRegion>
  )
}
