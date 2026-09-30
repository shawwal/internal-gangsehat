import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function FinanceLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardListSkeleton count={4} />
        <CardListSkeleton count={4} />
      </div>
    </SkeletonRegion>
  )
}
