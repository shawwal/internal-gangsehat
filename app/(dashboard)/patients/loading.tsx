import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function PatientsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={3} className="grid grid-cols-2 lg:grid-cols-3 gap-4" />
      <FiltersSkeleton count={3} />
      <TableSkeleton rows={10} cols={6} />
    </SkeletonRegion>
  )
}
