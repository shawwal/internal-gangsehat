import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, CardGridSkeleton } from '@/components/ui/Skeleton'

export default function MarketingCampaignsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={2} />
      <CardGridSkeleton count={6} />
    </SkeletonRegion>
  )
}
