import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, TableSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

export default function JadwalSportMassagePerformaLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={2} search={false} />
      <StatCardsSkeleton count={4} />
      <ChartSkeleton height={260} />
      <TableSkeleton rows={8} cols={6} />
    </SkeletonRegion>
  )
}
