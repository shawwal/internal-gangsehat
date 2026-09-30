import { SkeletonRegion, PageHeaderSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function BranchSettingsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <CardListSkeleton count={4} avatar={false} />
    </SkeletonRegion>
  )
}
