import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function OrderPackagesLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={4} />
      <FiltersSkeleton count={2} />
      <TableSkeleton rows={10} cols={6} />
    </SkeletonRegion>
  )
}
