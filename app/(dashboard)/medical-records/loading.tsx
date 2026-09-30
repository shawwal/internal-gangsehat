import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function MedicalRecordsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={4} />
      <FiltersSkeleton count={3} />
      <CardListSkeleton count={6} />
    </SkeletonRegion>
  )
}
