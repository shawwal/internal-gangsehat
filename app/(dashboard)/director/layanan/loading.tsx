import { SkeletonRegion, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorLayananLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <TableSkeleton rows={10} cols={5} />
    </SkeletonRegion>
  )
}
