import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton, DetailCardSkeleton } from '@/components/ui/Skeleton'

export default function OrderIdLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} back />
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DetailCardSkeleton rows={6} />
        <DetailCardSkeleton rows={6} />
      </div>
      <TableSkeleton rows={6} cols={5} />
      <TableSkeleton rows={4} cols={5} />
    </SkeletonRegion>
  )
}
