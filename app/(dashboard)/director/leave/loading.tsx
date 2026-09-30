import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function DirectorLeaveLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <StatCardsSkeleton count={4} className="grid grid-cols-2 sm:grid-cols-4 gap-3" />
      <FiltersSkeleton count={2} />
      <CardListSkeleton count={5} />
    </SkeletonRegion>
  )
}
