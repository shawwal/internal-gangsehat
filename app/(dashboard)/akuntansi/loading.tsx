import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

export default function AkuntansiLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={3} className="grid grid-cols-1 sm:grid-cols-3 gap-4" />
      <ChartSkeleton height={260} />
      <TableSkeleton rows={6} cols={4} />
    </SkeletonRegion>
  )
}
