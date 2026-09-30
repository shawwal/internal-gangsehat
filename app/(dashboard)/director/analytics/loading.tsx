import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, TabsSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

export default function DirectorAnalyticsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <StatCardsSkeleton count={4} />
      <TabsSkeleton count={4} />
      <ChartSkeleton height={320} />
    </SkeletonRegion>
  )
}
