import { Skeleton, SkeletonRegion, PageHeaderSkeleton } from '@/components/ui/Skeleton'

export default function InternalLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <Skeleton className="h-[300px] rounded-2xl" />
    </SkeletonRegion>
  )
}
