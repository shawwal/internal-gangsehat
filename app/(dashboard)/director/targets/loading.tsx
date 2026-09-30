import { SkeletonRegion, PageHeaderSkeleton, TabsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorTargetsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <TabsSkeleton count={3} />
      <TableSkeleton rows={8} cols={6} />
    </SkeletonRegion>
  )
}
