import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, ScheduleGridSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakJadwalLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <FiltersSkeleton count={1} search={false} />
      <ScheduleGridSkeleton rows={10} cols={6} />
    </SkeletonRegion>
  )
}
