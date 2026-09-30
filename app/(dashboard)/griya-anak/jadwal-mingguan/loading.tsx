import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, ScheduleGridSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakJadwalMingguanLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <FiltersSkeleton count={1} search={false} />
      <ScheduleGridSkeleton rows={8} cols={7} />
    </SkeletonRegion>
  )
}
