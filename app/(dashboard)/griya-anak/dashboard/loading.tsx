import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakDashboardLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <StatCardsSkeleton count={4} />
      <CardListSkeleton count={5} />
    </SkeletonRegion>
  )
}
