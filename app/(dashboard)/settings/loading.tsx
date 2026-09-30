import { Skeleton, SkeletonRegion, PageHeaderSkeleton } from '@/components/ui/Skeleton'

export default function SettingsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </SkeletonRegion>
  )
}
