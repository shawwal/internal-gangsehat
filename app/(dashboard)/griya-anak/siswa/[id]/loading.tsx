import { SkeletonRegion, PageHeaderSkeleton, TabsSkeleton, TableSkeleton, DetailCardSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakSiswaIdLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} back />
      <DetailCardSkeleton rows={8} />
      <TabsSkeleton count={3} />
      <TableSkeleton rows={6} cols={5} />
    </SkeletonRegion>
  )
}
