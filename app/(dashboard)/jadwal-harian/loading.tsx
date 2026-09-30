import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, ScheduleGridSkeleton } from '@/components/ui/Skeleton'

export default function JadwalHarianLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <FiltersSkeleton count={2} search={false} />
      <ScheduleGridSkeleton rows={12} cols={6} />
    </SkeletonRegion>
  )
}
