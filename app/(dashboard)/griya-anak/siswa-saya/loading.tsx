import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakSiswaSayaLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={3} className="grid grid-cols-1 sm:grid-cols-3 gap-4" />
      <FiltersSkeleton count={1} />
      <CardListSkeleton count={6} />
    </SkeletonRegion>
  )
}
