import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorPayrollLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={4} />
      <FiltersSkeleton count={2} />
      <TableSkeleton rows={8} cols={6} />
    </SkeletonRegion>
  )
}
