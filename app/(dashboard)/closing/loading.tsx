import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, FiltersSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function ClosingLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={1} search={false} />
      <StatCardsSkeleton count={3} className="grid grid-cols-1 sm:grid-cols-3 gap-4" />
      <FormSkeleton fields={8} columns={2} />
    </SkeletonRegion>
  )
}
