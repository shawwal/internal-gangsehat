import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function DirectorScheduleSlotsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={1} search={false} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardListSkeleton count={5} avatar={false} />
        <CardListSkeleton count={5} avatar={false} />
      </div>
    </SkeletonRegion>
  )
}
