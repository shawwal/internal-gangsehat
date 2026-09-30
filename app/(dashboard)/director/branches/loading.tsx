import { SkeletonRegion, PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/Skeleton'

export default function DirectorBranchesLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <CardGridSkeleton count={6} />
    </SkeletonRegion>
  )
}
