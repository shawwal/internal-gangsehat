import { SkeletonRegion, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorUsersDeletedLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} back />
      <TableSkeleton rows={8} cols={5} />
    </SkeletonRegion>
  )
}
