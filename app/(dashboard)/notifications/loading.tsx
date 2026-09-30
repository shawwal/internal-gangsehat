import { SkeletonRegion, PageHeaderSkeleton, CardListSkeleton } from '@/components/ui/Skeleton'

export default function NotificationsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <CardListSkeleton count={8} />
    </SkeletonRegion>
  )
}
