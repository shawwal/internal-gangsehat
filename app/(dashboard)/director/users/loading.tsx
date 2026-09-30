import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, TabsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorUsersLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <TabsSkeleton count={2} />
      <FiltersSkeleton count={2} />
      <TableSkeleton rows={10} cols={6} />
    </SkeletonRegion>
  )
}
