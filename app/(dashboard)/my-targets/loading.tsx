import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function MyTargetsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={4} className="grid grid-cols-2 sm:grid-cols-4 gap-3" />
      <CardListSkeleton count={4} avatar={false} />
    </SkeletonRegion>
  )
}
