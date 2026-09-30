import { SkeletonRegion, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorAccessControlLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <TableSkeleton rows={10} cols={5} />
    </SkeletonRegion>
  )
}
