import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, TabsSkeleton, TableSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

export default function DirectorPerformanceLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <FiltersSkeleton count={2} search={false} />
      <TabsSkeleton count={3} />
      <StatCardsSkeleton count={4} />
      <ChartSkeleton height={260} />
      <TableSkeleton rows={8} cols={5} />
    </SkeletonRegion>
  )
}
