import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, ScheduleGridSkeleton } from '@/components/ui/Skeleton'

export default function JadwalSportMassageLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <FiltersSkeleton count={1} search={false} />
      <ScheduleGridSkeleton rows={12} cols={5} />
    </SkeletonRegion>
  )
}
